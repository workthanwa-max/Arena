package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Open initializes a tuned PostgreSQL connection pool and executes idempotent schema migrations.
func Open(ctx context.Context, databaseURL string) (*sql.DB, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	// Tune pool for concurrent room persistence & fast audit flushes on multi-core hosts.
	db.SetMaxOpenConns(32)
	db.SetMaxIdleConns(16)
	db.SetConnMaxLifetime(30 * time.Minute)
	db.SetConnMaxIdleTime(5 * time.Minute)

	// Wait briefly if PostgreSQL container is still completing startup initialization.
	var pingErr error
	for attempt := 0; attempt < 15; attempt++ {
		pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
		pingErr = db.PingContext(pingCtx)
		cancel()
		if pingErr == nil {
			break
		}
		if ctx.Err() != nil {
			_ = db.Close()
			return nil, fmt.Errorf("ping postgres canceled: %w", pingErr)
		}
		select {
		case <-time.After(1 * time.Second):
		case <-ctx.Done():
			_ = db.Close()
			return nil, fmt.Errorf("ping postgres canceled: %w", ctx.Err())
		}
	}
	if pingErr != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping postgres: %w", pingErr)
	}

	if err := migrate(ctx, db); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("migrate postgres: %w", err)
	}

	return db, nil
}

func migrate(ctx context.Context, db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		display_name TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'player',
		selected_character_id TEXT NOT NULL DEFAULT 'pa',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';

	CREATE TABLE IF NOT EXISTS user_characters (
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		character_id TEXT NOT NULL,
		unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (user_id, character_id)
	);

	CREATE TABLE IF NOT EXISTS user_sessions (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token_hash TEXT NOT NULL UNIQUE,
		user_agent TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		revoked_at TIMESTAMPTZ
	);

	CREATE TABLE IF NOT EXISTS rooms (
		id TEXT PRIMARY KEY,
		max_players INTEGER NOT NULL,
		status TEXT NOT NULL,
		mode TEXT NOT NULL DEFAULT 'ffa',
		map_id TEXT NOT NULL DEFAULT 'shibuya',
		target_kills INTEGER NOT NULL DEFAULT 0,
		host_user_id TEXT NOT NULL DEFAULT '',
		winner_team TEXT NOT NULL DEFAULT '',
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		closed_at TIMESTAMPTZ
	);

	ALTER TABLE rooms ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'ffa';
	ALTER TABLE rooms ADD COLUMN IF NOT EXISTS map_id TEXT NOT NULL DEFAULT 'shibuya';
	ALTER TABLE rooms ADD COLUMN IF NOT EXISTS target_kills INTEGER NOT NULL DEFAULT 0;
	ALTER TABLE rooms ADD COLUMN IF NOT EXISTS host_user_id TEXT NOT NULL DEFAULT '';
	ALTER TABLE rooms ADD COLUMN IF NOT EXISTS winner_team TEXT NOT NULL DEFAULT '';

	CREATE TABLE IF NOT EXISTS room_players (
		id TEXT PRIMARY KEY,
		room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
		player_name TEXT NOT NULL,
		user_id TEXT NOT NULL DEFAULT '',
		team TEXT NOT NULL DEFAULT 'ffa',
		joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		left_at TIMESTAMPTZ
	);

	ALTER TABLE room_players ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT '';
	ALTER TABLE room_players ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'ffa';

	CREATE TABLE IF NOT EXISTS game_records (
		id BIGSERIAL PRIMARY KEY,
		room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
		event_type TEXT NOT NULL,
		payload JSONB NOT NULL,
		created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
	CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_user_sessions_token_active ON user_sessions(token_hash) WHERE revoked_at IS NULL;
	CREATE INDEX IF NOT EXISTS idx_room_players_room_id ON room_players(room_id);
	CREATE INDEX IF NOT EXISTS idx_game_records_room_id ON game_records(room_id);
	CREATE INDEX IF NOT EXISTS idx_game_records_created_at ON game_records(created_at DESC);
	`
	_, err := db.ExecContext(ctx, schema)
	return err
}
