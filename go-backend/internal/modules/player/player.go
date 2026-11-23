package player

import (
	"crypto/rand"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"strings"
	"unicode"
)

var colorPalette = []string{
	"#3B82F6", // Blue
	"#10B981", // Emerald
	"#F59E0B", // Amber
	"#EF4444", // Red
	"#8B5CF6", // Violet
}

// Manager handles player identity generation, name sanitization, and input clamping.
type Manager struct{}

// NewManager creates a Player Manager.
func NewManager() *Manager {
	return &Manager{}
}

// SanitizeName trims whitespace, strips control characters, and enforces 1..24 runes.
func (m *Manager) SanitizeName(raw string) (string, error) {
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, strings.TrimSpace(raw))

	runes := []rune(cleaned)
	if len(runes) == 0 || len(runes) > 24 {
		return "", fmt.Errorf("player name must be between 1 and 24 characters")
	}
	return cleaned, nil
}

// NewUUID generates a random RFC 4122 UUIDv4 string using crypto/rand.
func (m *Manager) NewUUID() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	buf := make([]byte, 36)
	hex.Encode(buf[0:8], b[0:4])
	buf[8] = '-'
	hex.Encode(buf[9:13], b[4:6])
	buf[13] = '-'
	hex.Encode(buf[14:18], b[6:8])
	buf[18] = '-'
	hex.Encode(buf[19:23], b[8:10])
	buf[23] = '-'
	hex.Encode(buf[24:36], b[10:16])
	return string(buf), nil
}

// NewRoomCode6 generates a 6-digit numeric room code in [100000, 999999] using crypto/rand.
func (m *Manager) NewRoomCode6() (string, error) {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	v := binary.BigEndian.Uint32(b[:]) % 900000
	return fmt.Sprintf("%06d", 100000+v), nil
}

// PickColor returns a distinct color for the player slot index.
func (m *Manager) PickColor(slotIndex int) string {
	return colorPalette[slotIndex%len(colorPalette)]
}

// ClampAxis clamps an analog or digital directional input axis to [-1, 1] with a small deadzone.
func (m *Manager) ClampAxis(v float64) float64 {
	if v > -0.08 && v < 0.08 {
		return 0
	}
	if v > 1 {
		return 1
	}
	if v < -1 {
		return -1
	}
	return v
}
