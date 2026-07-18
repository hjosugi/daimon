package config

import (
	"reflect"
	"testing"
)

func TestSplitCSV(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want []string
	}{
		{
			name: "plain values",
			in:   "https://one.example, https://two.example",
			want: []string{"https://one.example", "https://two.example"},
		},
		{
			name: "quoted values from deployment substitutions",
			in:   "'https://one.example','https://two.example'",
			want: []string{"https://one.example", "https://two.example"},
		},
		{
			name: "empty values",
			in:   `, "", '', https://one.example,`,
			want: []string{"https://one.example"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := splitCSV(tt.in); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("splitCSV(%q) = %#v, want %#v", tt.in, got, tt.want)
			}
		})
	}
}
