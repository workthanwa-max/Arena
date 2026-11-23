package persistence

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"sync"
	"time"
)

// RoomRecord represents persisted room metadata in PostgreSQL.
type RoomRecord struct {
	ID         string
	MaxPlayers int
	Status     string
	CreatedAt  time.Time
}

type asyncEvent struct {
	roomID    string
	eventType string
	payload   string
	createdAt time.Time
}

// Service manages PostgreSQL persistence for rooms, players, and batched async game records.
type Service struct {
	db      *sql.DB
	log     *slog.Logger
	eventCh chan asyncEvent
	doneCh  chan struct{}
	mu      sync.RWMutex
	closed  bool
}

// NewService creates a Persistence service and starts its non-blocking batched writer worker.
func NewService(db *sql.DB, log *slog.Logger) *Service {
	s := &Service{
		db:      db,
		log:     log,
		eventCh: make(chan asyncEvent, 2048),
		doneCh:  make(chan struct{}),
	}
	go s.runWorker()
	return s
}

func (s *Service) runWorker() {
	defer close(s.doneCh)
	batch := make([]asyncEvent, 0, 32)
	for ev := range s.eventCh {
		batch = append(batch[:0], ev)
	drain:
		for len(batch) < 32 {
			select {
			case next, ok := <-s.eventCh:
				if !ok {
					break drain
				}
				batch = append(batch, next)
			default:
				break drain
			}
		}
		s.flushBatch(batch)
	}
}

func (s *Service) flushBatch(batch []asyncEvent) {
	if s.db == nil || len(batch) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		s.log.Error("failed to begin postgres batch tx", "count", len(batch), "error", err)
		return
	}
	stmt, err := tx.PrepareContext(
		ctx,
		`INSERT INTO game_records (room_id, event_type, payload, created_at) VALUES ($1, $2, $3::jsonb, $4)`,
	)
	if err != nil {
		_ = tx.Rollback()
		s.log.Error("failed to prepare game_records insert", "error", err)
		return
	}
	defer func() {
		_ = stmt.Close()
	}()

	for _, ev := range batch {
		if _, err := stmt.ExecContext(ctx, ev.roomID, ev.eventType, ev.payload, ev.createdAt); err != nil {
			s.log.Error("failed to persist game record", "roomId", ev.roomID, "eventType", ev.eventType, "error", err)
		}
	}
	if err := tx.Commit(); err != nil {
		s.log.Error("failed to commit game_records batch", "error", err)
	}
}

// Close flushes queued async game records and stops the worker safely.
func (s *Service) Close() {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.closed = true
	close(s.eventCh)
	s.mu.Unlock()
	<-s.doneCh
}

// CreateRoom inserts a new room record into PostgreSQL.
func (s *Service) CreateRoom(ctx context.Context, roomID string, maxPlayers int, mode, mapID string, targetKills int, hostUserID string) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO rooms (id, max_players, status, mode, map_id, target_kills, host_user_id, created_at)
		 VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)`,
		roomID, maxPlayers, mode, mapID, targetKills, hostUserID, time.Now().UTC(),
	)
	return err
}

// RoomExists checks if a numeric room code is already persisted in PostgreSQL.
func (s *Service) RoomExists(ctx context.Context, roomID string) (bool, error) {
	if s.db == nil {
		return false, nil
	}
	var exists bool
	err := s.db.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1)`, roomID).Scan(&exists)
	return exists, err
}

// UpdateRoomMatchResult records final room status and winner team.
func (s *Service) UpdateRoomMatchResult(ctx context.Context, roomID, status, winnerTeam string) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE rooms SET status = $1, winner_team = $2 WHERE id = $3`,
		status, winnerTeam, roomID,
	)
	return err
}

// DeleteRoom removes a room and its cascaded records from PostgreSQL.
func (s *Service) DeleteRoom(ctx context.Context, roomID string) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(
		ctx,
		`DELETE FROM rooms WHERE id = $1`,
		roomID,
	)
	return err
}

// GetRoomMetadata fetches room metadata by code.
func (s *Service) GetRoomMetadata(ctx context.Context, roomID string) (*RoomRecord, error) {
	if s.db == nil {
		return nil, sql.ErrNoRows
	}
	row := s.db.QueryRowContext(
		ctx,
		`SELECT id, max_players, status, created_at FROM rooms WHERE id = $1`,
		roomID,
	)
	var rec RoomRecord
	if err := row.Scan(&rec.ID, &rec.MaxPlayers, &rec.Status, &rec.CreatedAt); err != nil {
		return nil, err
	}
	return &rec, nil
}

// RecordPlayerJoin persists a player joining a room.
func (s *Service) RecordPlayerJoin(ctx context.Context, playerID, roomID, playerName, userID, team string) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(
		ctx,
		`INSERT INTO room_players (id, room_id, player_name, user_id, team, joined_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		playerID, roomID, playerName, userID, team, time.Now().UTC(),
	)
	return err
}

// RecordPlayerLeave updates the leave timestamp for a player in a room.
func (s *Service) RecordPlayerLeave(ctx context.Context, playerID string) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.ExecContext(
		ctx,
		`UPDATE room_players SET left_at = $1 WHERE id = $2`,
		time.Now().UTC(), playerID,
	)
	return err
}

// RecordEventAsync queues a game event for non-blocking persistence.
func (s *Service) RecordEventAsync(roomID, eventType string, payload any) {
	if s.db == nil {
		return
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.closed {
		return
	}
	select {
	case s.eventCh <- asyncEvent{
		roomID:    roomID,
		eventType: eventType,
		payload:   string(raw),
		createdAt: time.Now().UTC(),
	}:
	default:
		// Drop non-critical audit event rather than blocking the real-time game loop.
	}
}
