package ws

import (
	"bufio"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"
)

const wsGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

// WebSocket opcodes defined in RFC 6455.
const (
	opContinuation = 0x0
	opText         = 0x1
	opBinary       = 0x2
	opClose        = 0x8
	opPing         = 0x9
	opPong         = 0xA
)

var (
	ErrClosed          = errors.New("websocket closed")
	ErrMessageTooLarge = errors.New("websocket message exceeds max size")
	ErrInvalidOrigin   = errors.New("websocket origin not allowed")
)

// Conn is a pure Go standard library RFC 6455 WebSocket connection.
type Conn struct {
	netConn   net.Conn
	rw        *bufio.ReadWriter
	writeMu   sync.Mutex
	closeMu   sync.Mutex
	closed    bool
	maxRead   int64
	readBuf   []byte
	writePool sync.Pool
}

// Upgrade validates the HTTP upgrade request against allowedOrigins and hijacks the TCP connection.
func Upgrade(w http.ResponseWriter, r *http.Request, allowedOrigins []string, maxReadBytes int64) (*Conn, error) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return nil, errors.New("invalid method")
	}

	origin := r.Header.Get("Origin")
	if origin != "" && len(allowedOrigins) > 0 && !slices.Contains(allowedOrigins, origin) {
		http.Error(w, "origin not allowed", http.StatusForbidden)
		return nil, ErrInvalidOrigin
	}

	if !headerContainsToken(r.Header.Get("Connection"), "upgrade") ||
		!strings.EqualFold(strings.TrimSpace(r.Header.Get("Upgrade")), "websocket") ||
		strings.TrimSpace(r.Header.Get("Sec-WebSocket-Version")) != "13" {
		http.Error(w, "bad websocket upgrade request", http.StatusBadRequest)
		return nil, errors.New("missing or invalid upgrade headers")
	}

	key := strings.TrimSpace(r.Header.Get("Sec-WebSocket-Key"))
	if key == "" {
		http.Error(w, "missing Sec-WebSocket-Key", http.StatusBadRequest)
		return nil, errors.New("missing Sec-WebSocket-Key")
	}

	hj, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "webserver does not support hijacking", http.StatusInternalServerError)
		return nil, errors.New("http.Hijacker unsupported")
	}

	netConn, rw, err := hj.Hijack()
	if err != nil {
		return nil, fmt.Errorf("hijack connection: %w", err)
	}
	if tcpConn, ok := netConn.(*net.TCPConn); ok {
		_ = tcpConn.SetNoDelay(true)
		_ = tcpConn.SetKeepAlive(true)
		_ = tcpConn.SetKeepAlivePeriod(30 * time.Second)
	}

	accept := computeAcceptKey(key)
	resp := "HTTP/1.1 101 Switching Protocols\r\n" +
		"Upgrade: websocket\r\n" +
		"Connection: Upgrade\r\n" +
		"Sec-WebSocket-Accept: " + accept + "\r\n\r\n"

	if _, err := rw.WriteString(resp); err != nil {
		_ = netConn.Close()
		return nil, fmt.Errorf("write handshake: %w", err)
	}
	if err := rw.Flush(); err != nil {
		_ = netConn.Close()
		return nil, fmt.Errorf("flush handshake: %w", err)
	}

	if maxReadBytes <= 0 {
		maxReadBytes = 4096
	}

	return &Conn{
		netConn: netConn,
		rw:      rw,
		maxRead: maxReadBytes,
		readBuf: make([]byte, 0, maxReadBytes),
	}, nil
}

// SetReadDeadline sets the read deadline on the underlying connection.
func (c *Conn) SetReadDeadline(t time.Time) error {
	return c.netConn.SetReadDeadline(t)
}

// ReadPacket reads the next complete WebSocket text or binary message, handling Ping/Pong/Close frames automatically.
func (c *Conn) ReadPacket() (isBinary bool, data []byte, err error) {
	var payloadBuf []byte
	var collecting bool
	var collectingBinary bool

	for {
		fin, opcode, frameData, err := c.readFrame()
		if err != nil {
			return false, nil, err
		}

		switch opcode {
		case opPing:
			_ = c.writeFrame(opPong, frameData)
			continue
		case opPong:
			continue
		case opClose:
			_ = c.WriteClose()
			return false, nil, ErrClosed
		case opText, opBinary:
			isBin := opcode == opBinary
			if fin {
				return isBin, frameData, nil
			}
			collecting = true
			collectingBinary = isBin
			payloadBuf = append(payloadBuf[:0], frameData...)
		case opContinuation:
			if !collecting {
				return false, nil, errors.New("unexpected continuation frame")
			}
			if int64(len(payloadBuf)+len(frameData)) > c.maxRead {
				return false, nil, ErrMessageTooLarge
			}
			payloadBuf = append(payloadBuf, frameData...)
			if fin {
				return collectingBinary, payloadBuf, nil
			}
		default:
			return false, nil, fmt.Errorf("unsupported opcode: %d", opcode)
		}
	}
}

// ReadText reads the next complete text message, automatically handling Ping/Pong/Close control frames.
func (c *Conn) ReadText() ([]byte, error) {
	isBin, data, err := c.ReadPacket()
	if err != nil {
		return nil, err
	}
	if isBin {
		return nil, errors.New("binary frames are not supported in text-only mode")
	}
	return data, nil
}

// WriteText sends a text frame to the client.
func (c *Conn) WriteText(data []byte) error {
	return c.writeFrame(opText, data)
}

// WriteBinary sends a binary frame to the client.
func (c *Conn) WriteBinary(data []byte) error {
	return c.writeFrame(opBinary, data)
}

// WriteReliableText implements Reliable/Unreliable transport abstraction cleanly over WebSocket text frames.
func (c *Conn) WriteReliableText(data []byte) error {
	return c.WriteText(data)
}

// WriteDatagramBinary implements Reliable/Unreliable transport abstraction over WebSocket binary frames.
func (c *Conn) WriteDatagramBinary(data []byte) error {
	return c.WriteBinary(data)
}

// WritePing sends a Ping control frame to the client.
func (c *Conn) WritePing() error {
	return c.writeFrame(opPing, []byte("ping"))
}

// WriteClose sends a Close control frame and closes the underlying TCP connection.
func (c *Conn) WriteClose() error {
	c.closeMu.Lock()
	if c.closed {
		c.closeMu.Unlock()
		return nil
	}
	c.closed = true
	c.closeMu.Unlock()

	_ = c.writeFrame(opClose, nil)
	return c.netConn.Close()
}

// Close closes the underlying TCP connection immediately.
func (c *Conn) Close() error {
	c.closeMu.Lock()
	if c.closed {
		c.closeMu.Unlock()
		return nil
	}
	c.closed = true
	c.closeMu.Unlock()
	return c.netConn.Close()
}

func (c *Conn) readFrame() (fin bool, opcode byte, payload []byte, err error) {
	var header [2]byte
	if _, err = io.ReadFull(c.rw, header[:]); err != nil {
		return false, 0, nil, err
	}

	fin = (header[0] & 0x80) != 0
	opcode = header[0] & 0x0F
	masked := (header[1] & 0x80) != 0
	length := int64(header[1] & 0x7F)

	if length == 126 {
		var ext [2]byte
		if _, err = io.ReadFull(c.rw, ext[:]); err != nil {
			return false, 0, nil, err
		}
		length = int64(binary.BigEndian.Uint16(ext[:]))
	} else if length == 127 {
		var ext [8]byte
		if _, err = io.ReadFull(c.rw, ext[:]); err != nil {
			return false, 0, nil, err
		}
		u := binary.BigEndian.Uint64(ext[:])
		if u > uint64(c.maxRead) {
			return false, 0, nil, ErrMessageTooLarge
		}
		length = int64(u)
	}

	if length > c.maxRead {
		return false, 0, nil, ErrMessageTooLarge
	}

	// RFC 6455 requires all client-to-server frames to be masked.
	if !masked {
		return false, 0, nil, errors.New("unmasked client frame")
	}

	var maskKey [4]byte
	if _, err = io.ReadFull(c.rw, maskKey[:]); err != nil {
		return false, 0, nil, err
	}

	nLen := int(length)
	if cap(c.readBuf) < nLen {
		c.readBuf = make([]byte, nLen)
	}
	payload = c.readBuf[:nLen]
	if length > 0 {
		if _, err = io.ReadFull(c.rw, payload); err != nil {
			return false, 0, nil, err
		}
		for i := range payload {
			payload[i] ^= maskKey[i%4]
		}
	}

	return fin, opcode, payload, nil
}

func (c *Conn) writeFrame(opcode byte, payload []byte) error {
	c.writeMu.Lock()
	defer c.writeMu.Unlock()

	_ = c.netConn.SetWriteDeadline(time.Now().Add(5 * time.Second))

	n := len(payload)
	var header [10]byte
	header[0] = 0x80 | (opcode & 0x0F)

	hLen := 2
	switch {
	case n <= 125:
		header[1] = byte(n)
	case n <= 65535:
		header[1] = 126
		binary.BigEndian.PutUint16(header[2:4], uint16(n))
		hLen = 4
	default:
		header[1] = 127
		binary.BigEndian.PutUint64(header[2:10], uint64(n))
		hLen = 10
	}

	totalLen := hLen + n
	if totalLen <= 8192 {
		var pktPtr *[]byte
		if v := c.writePool.Get(); v != nil {
			pktPtr = v.(*[]byte)
		} else {
			buf := make([]byte, 0, 2048)
			pktPtr = &buf
		}
		pkt := (*pktPtr)[:0]
		pkt = append(pkt, header[:hLen]...)
		pkt = append(pkt, payload...)
		_, err := c.rw.Write(pkt)
		if err == nil {
			err = c.rw.Flush()
		}
		if cap(pkt) <= 8192 {
			*pktPtr = pkt
			c.writePool.Put(pktPtr)
		}
		return err
	}

	if _, err := c.rw.Write(header[:hLen]); err != nil {
		return err
	}
	if n > 0 {
		if _, err := c.rw.Write(payload); err != nil {
			return err
		}
	}
	return c.rw.Flush()
}

func computeAcceptKey(key string) string {
	h := sha1.New()
	h.Write([]byte(key + wsGUID))
	return base64.StdEncoding.EncodeToString(h.Sum(nil))
}

func headerContainsToken(headerVal, token string) bool {
	for _, part := range strings.Split(headerVal, ",") {
		if strings.EqualFold(strings.TrimSpace(part), token) {
			return true
		}
	}
	return false
}
