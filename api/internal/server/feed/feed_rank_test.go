package feed

import "testing"

func TestNormalizeTimelinePage(t *testing.T) {
	req := timelineReq{Limit: 999, Offset: -2}
	normalizeTimelinePage(&req)

	if req.Limit != maxTimelinePageSize {
		t.Fatalf("limit = %d, want %d", req.Limit, maxTimelinePageSize)
	}
	if req.Offset != 0 {
		t.Fatalf("offset = %d, want 0", req.Offset)
	}
}

func TestNormalizeTimelinePageDefaults(t *testing.T) {
	req := timelineReq{}
	normalizeTimelinePage(&req)

	if req.Limit != defaultTimelinePageSize {
		t.Fatalf("limit = %d, want %d", req.Limit, defaultTimelinePageSize)
	}
}

func TestTimelinePage(t *testing.T) {
	req := timelineReq{Limit: 2, Offset: 2}
	got := timelinePage([]string{"a", "b", "c", "d", "e"}, req)
	want := []string{"c", "d"}

	if len(got) != len(want) {
		t.Fatalf("len(page) = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("page[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTimelinePagePastEnd(t *testing.T) {
	req := timelineReq{Limit: 20, Offset: 20}
	if got := timelinePage([]string{"a"}, req); got != nil {
		t.Fatalf("page = %#v, want nil", got)
	}
}
