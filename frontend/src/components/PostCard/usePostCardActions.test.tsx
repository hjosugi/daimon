import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  addComment,
  likePOV,
  likePost,
  type Post,
  savePost,
  type User,
} from "../../api/client"
import { createQueryClientWrapper } from "../../test/queryClient"
import { usePostCardActions } from "./usePostCardActions"

vi.mock("../../api/client", () => ({
  addComment: vi.fn(),
  deletePost: vi.fn(),
  getComments: vi.fn().mockResolvedValue([]),
  likePOV: vi.fn(),
  likePost: vi.fn(),
  savePost: vi.fn(),
  unlikePOV: vi.fn(),
  unlikePost: vi.fn(),
  unsavePost: vi.fn(),
}))

const mockedAddComment = vi.mocked(addComment)
const mockedLikePOV = vi.mocked(likePOV)
const mockedLikePost = vi.mocked(likePost)
const mockedSavePost = vi.mocked(savePost)

const currentUser: User = {
  id: "user-1",
  username: "alice",
  email: "alice@example.com",
}

function createPost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    text: "post body",
    povs: ["pov-a"],
    likes: 1,
    liked: false,
    saved: false,
    pov_stats: {
      "pov-a": { liked: false, likes: 2 },
    },
    ...overrides,
  }
}

describe("usePostCardActions", () => {
  beforeEach(() => {
    mockedLikePost.mockResolvedValue({ liked: true, likes: 2 })
    mockedSavePost.mockResolvedValue({ saved: true })
    mockedAddComment.mockResolvedValue({
      id: "comment-1",
      text: "hello",
      authorId: "user-1",
    })
    mockedLikePOV.mockResolvedValue({ liked: true, likes: 3 })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("optimistically patches post-like caches and reconciles server data", async () => {
    const post = createPost()
    const { queryClient, wrapper } = createQueryClientWrapper()
    queryClient.setQueryData<Post[]>(["timeline"], [post])
    queryClient.setQueryData<Post[]>(["search"], [post])

    const { result } = renderHook(() => usePostCardActions(post, currentUser), {
      wrapper,
    })

    act(() => {
      result.current.toggleLike()
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<Post[]>(["timeline"])).toEqual([
        expect.objectContaining({ liked: true, likes: 2 }),
      ])
      expect(queryClient.getQueryData<Post[]>(["search"])).toEqual([
        expect.objectContaining({ liked: true, likes: 2 }),
      ])
    })

    await waitFor(() => {
      expect(mockedLikePost).toHaveBeenCalledWith("post-1")
    })
  })

  it("rolls back optimistic save state when the request fails", async () => {
    mockedSavePost.mockRejectedValueOnce(new Error("network failed"))
    const post = createPost()
    const { queryClient, wrapper } = createQueryClientWrapper()
    queryClient.setQueryData<Post[]>(["timeline"], [post])

    const { result } = renderHook(() => usePostCardActions(post, currentUser), {
      wrapper,
    })

    act(() => {
      result.current.toggleSave()
    })

    await waitFor(() => {
      expect(result.current.saved).toBe(true)
    })

    await waitFor(() => {
      expect(result.current.saved).toBe(false)
      expect(queryClient.getQueryData<Post[]>(["timeline"])).toEqual([
        expect.objectContaining({ saved: false }),
      ])
    })
  })

  it("submits non-empty comments and clears the composer after success", async () => {
    const post = createPost()
    const { wrapper } = createQueryClientWrapper()
    const { result } = renderHook(() => usePostCardActions(post, currentUser), {
      wrapper,
    })

    act(() => {
      result.current.addCurrentComment()
      result.current.setCommentText("hello")
    })

    act(() => {
      result.current.addCurrentComment()
    })

    await waitFor(() => {
      expect(mockedAddComment).toHaveBeenCalledTimes(1)
      expect(mockedAddComment).toHaveBeenCalledWith("post-1", "hello")
      expect(result.current.commentText).toBe("")
    })
  })

  it("requires a current user before liking a POV and stores returned POV stats", async () => {
    const post = createPost()
    const { wrapper } = createQueryClientWrapper()
    const anonymous = renderHook(() => usePostCardActions(post, null), {
      wrapper,
    })

    act(() => {
      anonymous.result.current.togglePOVLike("pov-a")
    })

    expect(mockedLikePOV).not.toHaveBeenCalled()

    const signedIn = renderHook(() => usePostCardActions(post, currentUser), {
      wrapper,
    })

    act(() => {
      signedIn.result.current.togglePOVLike("pov-a")
    })

    await waitFor(() => {
      expect(mockedLikePOV).toHaveBeenCalledWith("pov-a")
      expect(signedIn.result.current.povLikes["pov-a"]).toEqual({
        liked: true,
        likes: 3,
      })
    })
  })
})
