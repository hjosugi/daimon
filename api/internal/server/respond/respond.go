package respond

import (
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5/middleware"

	"daimon/api/internal/httpx"
	"daimon/api/internal/server/session"
)

func Internal(w http.ResponseWriter, r *http.Request, logger *slog.Logger, detail string, err error, attrs ...slog.Attr) {
	logRequest(logger, slog.LevelError, r, detail, err, attrs...)
	httpx.Error(w, http.StatusInternalServerError, detail)
}

func Warn(logger *slog.Logger, r *http.Request, msg string, err error, attrs ...slog.Attr) {
	logRequest(logger, slog.LevelWarn, r, msg, err, attrs...)
}

func logRequest(logger *slog.Logger, level slog.Level, r *http.Request, msg string, err error, attrs ...slog.Attr) {
	if logger == nil {
		logger = slog.Default()
	}
	fields := []slog.Attr{
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
	}
	if reqID := middleware.GetReqID(r.Context()); reqID != "" {
		fields = append(fields, slog.String("request_id", reqID))
	}
	if uid := session.UserID(r.Context()); uid != "" {
		fields = append(fields, slog.String("user_id", uid))
	}
	if err != nil {
		fields = append(fields, slog.Any("error", err))
	}
	fields = append(fields, attrs...)
	logger.LogAttrs(r.Context(), level, msg, fields...)
}
