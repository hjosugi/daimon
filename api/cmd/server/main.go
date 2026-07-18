package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"daimon/api/internal/config"
	"daimon/api/internal/db"
	"daimon/api/internal/server"
)

func main() {
	cfg := config.FromEnv()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	s := server.New(pool, cfg)
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()
	go ensureSchema(appCtx, pool)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           s.Router(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		log.Printf("daimon-api listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
	appCancel()

	shutdownCtx, cancel2 := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel2()
	_ = srv.Shutdown(shutdownCtx)
	log.Println("daimon-api stopped")
}

func ensureSchema(ctx context.Context, pool *pgxpool.Pool) {
	delay := 5 * time.Second
	for attempt := 1; ; attempt++ {
		bootCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		err := db.EnsureSchema(bootCtx, pool)
		cancel()
		if err == nil {
			log.Println("schema bootstrap complete")
			return
		}
		log.Printf("schema bootstrap attempt %d failed: %v", attempt, err)
		select {
		case <-ctx.Done():
			return
		case <-time.After(delay):
		}
		delay *= 2
		if delay > time.Minute {
			delay = time.Minute
		}
	}
}
