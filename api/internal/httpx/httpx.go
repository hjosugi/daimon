// Package httpx contains small JSON request/response helpers.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

const MaxJSONBodyBytes int64 = 512 * 1024

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func Error(w http.ResponseWriter, status int, detail string) {
	JSON(w, status, map[string]string{"detail": detail})
}

// Decode reads a JSON body into v. Returns false (and writes 400) on failure.
func Decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, MaxJSONBodyBytes)
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			Error(w, http.StatusRequestEntityTooLarge, "Request body is too large")
			return false
		}
		Error(w, http.StatusBadRequest, "Invalid JSON body")
		return false
	}
	var extra struct{}
	if err := dec.Decode(&extra); err != io.EOF {
		Error(w, http.StatusBadRequest, "Invalid JSON body")
		return false
	}
	return true
}
