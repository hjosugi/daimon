// Package validate normalizes and validates account input (production-grade).
package validate

import (
	"regexp"
	"strings"
)

const (
	UsernameMax     = 30
	EmailMax        = 254
	PasswordMin     = 8
	PasswordMaxByte = 72 // bcrypt silently truncates beyond 72 bytes
)

var (
	emailRe   = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
	wsRunRe   = regexp.MustCompile(`\s+`)
	controlRe = regexp.MustCompile(`[\x00-\x1f\x7f]`)
)

// NormalizeUsername trims ends and collapses internal whitespace runs.
func NormalizeUsername(s string) string {
	return strings.TrimSpace(wsRunRe.ReplaceAllString(s, " "))
}

func Username(s string) (string, string) {
	u := NormalizeUsername(s)
	switch {
	case u == "":
		return "", "Username cannot be empty"
	case len([]rune(u)) > UsernameMax:
		return "", "Username must be 30 characters or less"
	case controlRe.MatchString(u) || strings.ContainsAny(u, "<>"):
		return "", "Username contains invalid characters"
	}
	return u, ""
}

func NormalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func Email(s string) (string, string) {
	e := NormalizeEmail(s)
	switch {
	case e == "":
		return "", "Email cannot be empty"
	case len(e) > EmailMax:
		return "", "Email is too long"
	case !emailRe.MatchString(e):
		return "", "Invalid email format"
	}
	return e, ""
}

func Password(s string) string {
	switch {
	case s == "":
		return "Password cannot be empty"
	case len([]rune(s)) < PasswordMin:
		return "Password must be at least 8 characters"
	case len(s) > PasswordMaxByte:
		return "Password must be 72 bytes or less"
	}
	return ""
}
