-- name: auth.session_user
SELECT user_id FROM sessions WHERE id=$1 AND expires_at > $2

-- name: auth.user_exists
SELECT
  EXISTS(SELECT 1 FROM users WHERE lower(username)=lower($1)),
  EXISTS(SELECT 1 FROM users WHERE email=$2)

-- name: auth.insert_user
INSERT INTO users (id, username, email, password_hash, avatar_url, bio, created_at, updated_at)
VALUES ($1,$2,$3,$4,NULL,$5,$6,$6)

-- name: auth.login_user
SELECT id, username, email, password_hash, avatar_url, bio
FROM users WHERE email=$1 OR lower(username)=lower($2) LIMIT 1

-- name: auth.user_by_id
SELECT id, username, email, avatar_url, bio FROM users WHERE id=$1

-- name: auth.username_taken
SELECT EXISTS(SELECT 1 FROM users WHERE lower(username)=lower($1) AND id != $2)

-- name: auth.update_username
UPDATE users SET username=$1, updated_at=$2 WHERE id=$3

-- name: auth.update_avatar_url
UPDATE users SET avatar_url=$1, updated_at=$2 WHERE id=$3

-- name: auth.update_bio
UPDATE users SET bio=$1, updated_at=$2 WHERE id=$3

-- name: auth.delete_session
DELETE FROM sessions WHERE id=$1

-- name: auth.delete_user
DELETE FROM users WHERE id=$1

-- name: auth.user_post_ids
SELECT id FROM posts WHERE user_id=$1

-- name: auth.insert_session
INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)

-- name: posts.username_by_id
SELECT username FROM users WHERE id=$1

-- name: posts.insert_post
INSERT INTO posts (id, user_id, username, text, created_at, updated_at)
VALUES ($1,$2,$3,$4,$5,$5)

-- name: posts.insert_pov
INSERT INTO povs (id, post_id, pov, is_auto, created_at) VALUES ($1,$2,$3,false,$4)

-- name: posts.owner
SELECT user_id FROM posts WHERE id=$1

-- name: posts.delete
DELETE FROM posts WHERE id=$1

-- name: posts.exists
SELECT EXISTS(SELECT 1 FROM posts WHERE id=$1)

-- name: posts.like_count
SELECT count(*) FROM likes WHERE post_id=$1

-- name: posts.insert_like
INSERT INTO likes (id, post_id, user_id, created_at) VALUES ($1,$2,$3,$4)
ON CONFLICT (post_id, user_id) DO NOTHING

-- name: posts.delete_like
DELETE FROM likes WHERE post_id=$1 AND user_id=$2

-- name: posts.likers
SELECT u.id, u.username
FROM likes l JOIN users u ON u.id = l.user_id
WHERE l.post_id=$1 ORDER BY l.created_at DESC LIMIT 200

-- name: posts.comments
SELECT c.id, c.text, c.user_id, u.username, c.created_at
FROM comments c LEFT JOIN users u ON u.id = c.user_id
WHERE c.post_id=$1 ORDER BY c.created_at ASC

-- name: posts.insert_comment
INSERT INTO comments (id, post_id, user_id, text, created_at) VALUES ($1,$2,$3,$4,$5)

-- name: feed.load_posts
SELECT id, user_id, COALESCE(username,''), text, created_at FROM posts WHERE id = ANY($1)

-- name: feed.load_povs
SELECT post_id, pov FROM povs WHERE post_id = ANY($1)

-- name: feed.like_counts
SELECT post_id, count(*) FROM likes WHERE post_id = ANY($1) GROUP BY post_id

-- name: feed.comment_counts
SELECT post_id, count(*) FROM comments WHERE post_id = ANY($1) GROUP BY post_id

-- name: feed.save_counts
SELECT post_id, count(*) FROM bookmarks WHERE post_id = ANY($1) GROUP BY post_id

-- name: feed.user_saved_ids
SELECT post_id FROM bookmarks WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100

-- name: feed.liked_set
SELECT post_id FROM likes WHERE post_id = ANY($1) AND user_id=$2

-- name: feed.saved_set
SELECT post_id FROM bookmarks WHERE post_id = ANY($1) AND user_id=$2

-- name: feed.user_povs
SELECT p.pov FROM povs p JOIN posts po ON po.id = p.post_id WHERE po.user_id=$1

-- name: feed.recent_popular_matched_ids
SELECT po.id
FROM posts po
JOIN povs pv ON pv.post_id = po.id
LEFT JOIN likes l ON l.post_id = po.id
WHERE po.user_id <> $1 AND pv.pov = ANY($2)
GROUP BY po.id, po.created_at
ORDER BY count(DISTINCT pv.pov) DESC, po.created_at DESC, count(DISTINCT l.id) DESC
LIMIT $3

-- name: feed.search_pov_ids
SELECT DISTINCT post_id FROM povs WHERE pov = ANY($1) LIMIT $2

-- name: feed.search_query_pov_ids
SELECT DISTINCT post_id FROM povs
WHERE lower(pov) = lower($1) OR lower(pov) LIKE '%' || lower($1) || '%'
LIMIT $2

-- name: feed.user_post_ids
SELECT id FROM posts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50

-- name: povs.suggest
SELECT pov, count(*) AS c FROM povs
WHERE ($1 = '' OR lower(pov) LIKE '%' || $1 || '%')
GROUP BY pov ORDER BY c DESC LIMIT 50

-- name: pov_likes.count
SELECT count(*) FROM pov_likes WHERE pov=$1

-- name: pov_likes.insert
INSERT INTO pov_likes (id, pov, user_id, created_at) VALUES ($1,$2,$3,$4)
ON CONFLICT (pov, user_id) DO NOTHING

-- name: pov_likes.delete
DELETE FROM pov_likes WHERE pov=$1 AND user_id=$2

-- name: pov_likes.status
SELECT EXISTS(SELECT 1 FROM pov_likes WHERE pov=$1 AND user_id=$2)

-- name: pov_likes.counts
SELECT pov, count(*) FROM pov_likes WHERE pov = ANY($1) GROUP BY pov

-- name: pov_likes.liked_set
SELECT pov FROM pov_likes WHERE pov = ANY($1) AND user_id=$2

-- name: pov_comments.list
SELECT pc.id, pc.pov, pc.text, pc.stance, pc.user_id, u.username, u.avatar_url, pc.created_at
FROM pov_comments pc
JOIN users u ON u.id = pc.user_id
WHERE lower(pc.pov) = lower($1)
ORDER BY pc.created_at DESC
LIMIT 100

-- name: pov_comments.insert
INSERT INTO pov_comments (id, pov, user_id, text, stance, created_at)
VALUES ($1,$2,$3,$4,$5,$6)

-- name: pov_comments.delete_own
DELETE FROM pov_comments WHERE id=$1 AND user_id=$2

-- name: follows.follower_count
SELECT count(*) FROM follows WHERE followee_id=$1

-- name: follows.profile_user
SELECT username, avatar_url, bio FROM users WHERE id=$1

-- name: follows.posts_count
SELECT count(*) FROM posts WHERE user_id=$1

-- name: follows.following_count
SELECT count(*) FROM follows WHERE follower_id=$1

-- name: follows.status
SELECT EXISTS(SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2)

-- name: follows.user_exists
SELECT EXISTS(SELECT 1 FROM users WHERE id=$1)

-- name: follows.insert
INSERT INTO follows (id, follower_id, followee_id, created_at) VALUES ($1,$2,$3,$4)
ON CONFLICT (follower_id, followee_id) DO NOTHING

-- name: follows.delete
DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2

-- name: follows.followers
SELECT u.id, u.username, u.avatar_url, u.bio
FROM follows f
JOIN users u ON u.id = f.follower_id
WHERE f.followee_id=$1
ORDER BY f.created_at DESC
LIMIT 200

-- name: follows.remove_follower
DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2

-- name: follows.feed
SELECT p.id FROM posts p
JOIN follows f ON f.followee_id = p.user_id
WHERE f.follower_id = $1
ORDER BY p.created_at DESC LIMIT 50

-- name: bookmarks.insert
INSERT INTO bookmarks (id, user_id, post_id, created_at) VALUES ($1,$2,$3,$4)
ON CONFLICT (user_id, post_id) DO NOTHING

-- name: bookmarks.delete
DELETE FROM bookmarks WHERE user_id=$1 AND post_id=$2

-- name: bookmarks.status
SELECT EXISTS(SELECT 1 FROM bookmarks WHERE user_id=$1 AND post_id=$2)

-- name: bookmarks.feed
SELECT post_id FROM bookmarks WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100

-- name: batch.popular_povs
SELECT pov, count(*) AS c FROM povs GROUP BY pov ORDER BY c DESC LIMIT 200

-- name: batch.distinct_posters
SELECT DISTINCT user_id FROM posts

-- name: batch.long_posts
SELECT id, text FROM posts WHERE char_length(text) > $1 ORDER BY created_at DESC LIMIT $2

-- name: batch.insert_auto_pov
INSERT INTO povs (id, post_id, pov, is_auto, created_at) VALUES ($1,$2,$3,true,$4)
ON CONFLICT (post_id, pov) DO NOTHING
