package session

import "testing"

func TestHashTokenIsDeterministicAndNotPlaintext(t *testing.T) {
	token := "plain-token"
	hash := HashToken(token)
	if hash == token {
		t.Fatal("hash should not equal plaintext token")
	}
	if len(hash) != 64 {
		t.Fatalf("hash length = %d, want 64", len(hash))
	}
	if HashToken(token) != hash {
		t.Fatal("hash should be deterministic")
	}
}
