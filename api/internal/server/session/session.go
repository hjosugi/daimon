package session

import "context"

type ctxKey string

const userIDKey ctxKey = "userID"

func WithUserID(ctx context.Context, uid string) context.Context {
	return context.WithValue(ctx, userIDKey, uid)
}

func UserID(ctx context.Context) string {
	v, _ := ctx.Value(userIDKey).(string)
	return v
}
