package wt

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"io"
	"math/big"
	"net"
	"net/http"
	"slices"
	"sync"
	"time"

	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

type inboundPacket struct {
	isBinary bool
	data     []byte
}

// Conn wraps a WebTransport HTTP/3 QUIC session as a dual-channel RealtimeConn:
//   - WriteDatagramBinary -> Unreliable UDP/QUIC Datagram (movement inputs & high-freq world state ticks)
//   - WriteReliableText   -> Reliable Ordered QUIC Stream (join, skill, snap, match result, errors)
type Conn struct {
	sess      *webtransport.Session
	stream    *webtransport.Stream
	writeMu   sync.Mutex
	closeMu   sync.Mutex
	closed    bool
	pktCh     chan inboundPacket
	errCh     chan error
	ctx       context.Context
	cancel    context.CancelFunc
	deadlineM sync.Mutex
	readDead  time.Time
}

// NewConn attaches to an upgraded WebTransport session and accepts its primary reliable control stream.
func NewConn(sess *webtransport.Session) (*Conn, error) {
	ctx, cancel := context.WithCancel(sess.Context())
	streamCtx, streamCancel := context.WithTimeout(ctx, 5*time.Second)
	defer streamCancel()

	stream, err := sess.AcceptStream(streamCtx)
	if err != nil {
		cancel()
		return nil, err
	}

	c := &Conn{
		sess:   sess,
		stream: stream,
		pktCh:  make(chan inboundPacket, 64),
		errCh:  make(chan error, 1),
		ctx:    ctx,
		cancel: cancel,
	}

	go c.pumpDatagrams()
	go c.pumpReliableStream()
	return c, nil
}

func (c *Conn) pumpDatagrams() {
	for {
		raw, err := c.sess.ReceiveDatagram(c.ctx)
		if err != nil {
			c.pushErr(err)
			return
		}
		if len(raw) == 0 {
			continue
		}
		cp := make([]byte, len(raw))
		copy(cp, raw)
		select {
		case c.pktCh <- inboundPacket{isBinary: true, data: cp}:
		default:
			// Drop saturated stale datagram rather than stalling QUIC reader loop
		}
	}
}

func (c *Conn) pumpReliableStream() {
	var lenBuf [4]byte
	for {
		if _, err := io.ReadFull(c.stream, lenBuf[:]); err != nil {
			c.pushErr(err)
			return
		}
		n := binary.LittleEndian.Uint32(lenBuf[:])
		if n == 0 {
			// Skip client control-stream open preface cleanly
			continue
		}
		if n > 16384 {
			c.pushErr(errors.New("invalid reliable stream frame size"))
			return
		}
		buf := make([]byte, n)
		if _, err := io.ReadFull(c.stream, buf); err != nil {
			c.pushErr(err)
			return
		}
		select {
		case c.pktCh <- inboundPacket{isBinary: buf[0] != '{', data: buf}:
		case <-c.ctx.Done():
			return
		}
	}
}

func (c *Conn) pushErr(err error) {
	select {
	case c.errCh <- err:
	default:
	}
}

// ReadPacket receives either an Unreliable QUIC Datagram or a Reliable QUIC Stream message.
func (c *Conn) ReadPacket() (bool, []byte, error) {
	c.deadlineM.Lock()
	dl := c.readDead
	c.deadlineM.Unlock()

	var timer *time.Timer
	var timerCh <-chan time.Time
	if !dl.IsZero() {
		wait := time.Until(dl)
		if wait <= 0 {
			return false, nil, errors.New("read deadline exceeded")
		}
		timer = time.NewTimer(wait)
		timerCh = timer.C
		defer timer.Stop()
	}

	select {
	case pkt := <-c.pktCh:
		return pkt.isBinary, pkt.data, nil
	case err := <-c.errCh:
		return false, nil, err
	case <-timerCh:
		return false, nil, errors.New("read deadline exceeded")
	case <-c.ctx.Done():
		return false, nil, errors.New("webtransport session closed")
	}
}

// WriteDatagramBinary sends a compact binary state tick over an Unreliable QUIC Datagram (zero TCP HoL!).
func (c *Conn) WriteDatagramBinary(data []byte) error {
	return c.sess.SendDatagram(data)
}

// WriteReliableText sends a guaranteed ordered control/event payload over the QUIC Reliable Stream.
func (c *Conn) WriteReliableText(data []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	var hdr [4]byte
	binary.LittleEndian.PutUint32(hdr[:], uint32(len(data)))
	if _, err := c.stream.Write(hdr[:]); err != nil {
		return err
	}
	if len(data) > 0 {
		if _, err := c.stream.Write(data); err != nil {
			return err
		}
	}
	return nil
}

// WritePing is handled natively by QUIC keep-alive / binary ping-pong frames.
func (c *Conn) WritePing() error {
	return nil
}

// SetReadDeadline sets the logical read timeout used by ReadPacket.
func (c *Conn) SetReadDeadline(t time.Time) error {
	c.deadlineM.Lock()
	c.readDead = t
	c.deadlineM.Unlock()
	return nil
}

// Close closes the WebTransport QUIC session cleanly.
func (c *Conn) Close() error {
	c.closeMu.Lock()
	if c.closed {
		c.closeMu.Unlock()
		return nil
	}
	c.closed = true
	c.closeMu.Unlock()

	c.cancel()
	_ = c.stream.Close()
	return c.sess.CloseWithError(0, "closed")
}

// BuildEphemeralServerTLS creates a W3C-compliant <=14-day ECDSA P-256 cert + Base64 SHA-256 fingerprint for local WebTransport.
func BuildEphemeralServerTLS() (*tls.Config, string, error) {
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, "", err
	}
	now := time.Now().UTC()
	tmpl := x509.Certificate{
		SerialNumber: big.NewInt(now.UnixNano()),
		Subject:      pkix.Name{CommonName: "PulseArena WebTransport Dev"},
		NotBefore:    now.Add(-1 * time.Hour),
		NotAfter:     now.Add(10 * 24 * time.Hour), // Strictly <= 14 days for browser serverCertificateHashes
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{"localhost", "127.0.0.1"},
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &priv.PublicKey, priv)
	if err != nil {
		return nil, "", err
	}
	sum := sha256.Sum256(der)
	fpB64 := base64.StdEncoding.EncodeToString(sum[:])

	cert := tls.Certificate{
		Certificate: [][]byte{der},
		PrivateKey:  priv,
	}
	tlsCfg := &tls.Config{
		Certificates: []tls.Certificate{cert},
		NextProtos:   []string{http3.NextProtoH3},
		MinVersion:   tls.VersionTLS13,
	}
	return tlsCfg, fpB64, nil
}

// NewServer constructs an HTTP/3 + QUIC WebTransport server ready to Serve/Listen over UDP.
func NewServer(addr string, tlsCfg *tls.Config, allowedOrigins []string, handler http.Handler) *webtransport.Server {
	h3 := &http3.Server{
		Addr:      addr,
		TLSConfig: tlsCfg,
		Handler:   handler,
	}
	webtransport.ConfigureHTTP3Server(h3)
	return &webtransport.Server{
		H3: h3,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" || len(allowedOrigins) == 0 {
				return true
			}
			return slices.Contains(allowedOrigins, origin)
		},
	}
}
