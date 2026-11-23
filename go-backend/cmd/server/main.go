package main

import (
	"crypto/tls"
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"go-backend/internal/api"
	"go-backend/internal/infrastructure/config"
	"go-backend/internal/infrastructure/database"
	"go-backend/internal/infrastructure/logger"
	"go-backend/internal/modules/auth"
	"go-backend/internal/modules/engine"
	"go-backend/internal/modules/persistence"
	"go-backend/internal/modules/player"
	"go-backend/internal/modules/room"
	"go-backend/internal/modules/session"
	gamesync "go-backend/internal/modules/sync"
	"go-backend/internal/shared/wt"

	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

func main() {
	// Utilize all available CPU cores for maximum concurrency and tick throughput.
	runtime.GOMAXPROCS(runtime.NumCPU())

	log := logger.New()

	cfg, err := config.Load()
	if err != nil {
		log.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("failed to initialize postgres", "error", err)
		os.Exit(1)
	}
	defer func() {
		_ = db.Close()
	}()

	authSvc := auth.NewService(db, log)
	if err := authSvc.EnsureAdminUser(ctx, "thanwa", "880329"); err != nil {
		log.Error("failed to seed admin account", "error", err)
		os.Exit(1)
	}
	persistSvc := persistence.NewService(db, log)
	defer persistSvc.Close()

	playerMgr := player.NewManager()
	gameEngine := engine.NewEngine()
	syncer := gamesync.NewSynchronizer()
	sessMgr := session.NewManager(log, syncer)
	roomMgr := room.NewManager(
		cfg.MaxPlayersPerRoom,
		cfg.TickRateHz,
		cfg.ShareBaseURL,
		gameEngine,
		playerMgr,
		sessMgr,
		syncer,
		persistSvc,
		log,
	)

	// Optional HTTP/3 QUIC WebTransport Server (Datagram + Reliable Stream)
	var wtSrv *webtransport.Server
	if cfg.WTPort != "" && os.Getenv("DISABLE_WT") != "1" {
		var tlsCfg *tls.Config
		if cfg.WTCertFile != "" && cfg.WTKeyFile != "" {
			if cert, certErr := tls.LoadX509KeyPair(cfg.WTCertFile, cfg.WTKeyFile); certErr == nil {
				tlsCfg = &tls.Config{Certificates: []tls.Certificate{cert}, NextProtos: []string{http3.NextProtoH3}, MinVersion: tls.VersionTLS13}
			}
		}
		if tlsCfg == nil {
			if ephTLS, fpB64, tlsErr := wt.BuildEphemeralServerTLS(); tlsErr == nil {
				tlsCfg = ephTLS
				cfg.WTCertHash = fpB64
			}
		}
		if tlsCfg != nil {
			wtHandler := api.NewWebTransportHandler(cfg, authSvc, roomMgr, sessMgr, log, func() *webtransport.Server { return wtSrv })
			wtSrv = wt.NewServer(":"+cfg.WTPort, tlsCfg, cfg.AllowedOrigins, wtHandler)
			go func() {
				log.Info("webtransport HTTP/3 QUIC server listening", "udpPort", cfg.WTPort)
				if err := wtSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
					log.Warn("webtransport server stopped", "error", err)
				}
			}()
		}
	}

	router := api.NewRouter(cfg, db, authSvc, roomMgr, sessMgr, syncer, log)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Info("go game server listening", "port", cfg.Port, "tickRateHz", cfg.TickRateHz, "maxPlayersPerRoom", cfg.MaxPlayersPerRoom)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "error", err)
			stop()
		}
	}()

	<-ctx.Done()
	log.Info("shutdown signal received")

	roomMgr.Shutdown()
	if wtSrv != nil {
		_ = wtSrv.Close()
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("http shutdown error", "error", err)
	}
	log.Info("server stopped cleanly")
}
