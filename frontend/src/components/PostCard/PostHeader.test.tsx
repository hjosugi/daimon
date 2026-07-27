import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Post, User } from "../../api/client"
import { I18nProvider } from "../../i18n"
import { PostHeader } from "./PostHeader"

const viewer: User = {
  id: "viewer",
  username: "viewer",
  email: "viewer@example.com",
}

describe("PostHeader", () => {
  it("keeps a zero-percent match clickable so its reason can be inspected", () => {
    const onMatchDetailsClick = vi.fn()
    const post: Post = {
      id: "post-1",
      user_id: "author",
      username: "author",
      text: "A different perspective",
      povs: [],
      match_reason: {
        pov_matches: [],
        common_povs: [],
        pov_match_rate: 0,
        matched_by: "both",
        reason: "new_perspective",
        sense_distance: 0.82,
      },
    }

    render(
      <I18nProvider>
        <PostHeader
          post={post}
          currentUser={viewer}
          onMatchDetailsClick={onMatchDetailsClick}
        />
      </I18nProvider>,
    )

    const matchButton = screen.getByTitle("See why this post appeared")
    expect(matchButton).toBeEnabled()

    fireEvent.click(matchButton)
    expect(onMatchDetailsClick).toHaveBeenCalledTimes(1)
  })
})
