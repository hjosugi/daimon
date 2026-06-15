-- Idempotent schema. Matches the original alembic migration so it works
-- against both a fresh database and the existing seeded one.

CREATE TABLE IF NOT EXISTS users (
  id            varchar PRIMARY KEY,
  username      varchar NOT NULL,
  email         varchar NOT NULL,
  password_hash varchar NOT NULL,
  avatar_url    varchar,
  bio           text,
  created_at    timestamp NOT NULL,
  updated_at    timestamp NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text;

CREATE TABLE IF NOT EXISTS sessions (
  id         varchar PRIMARY KEY,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL,
  expires_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS ix_sessions_expires_at ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS posts (
  id         varchar PRIMARY KEY,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username   varchar,
  text       text NOT NULL,
  created_at timestamp NOT NULL,
  updated_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_posts_user_id ON posts (user_id);
CREATE INDEX IF NOT EXISTS ix_posts_created_at ON posts (created_at);

CREATE TABLE IF NOT EXISTS povs (
  id         varchar PRIMARY KEY,
  post_id    varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  pov        varchar NOT NULL,
  is_auto    boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL,
  CONSTRAINT uq_povs_post_pov UNIQUE (post_id, pov)
);
CREATE INDEX IF NOT EXISTS ix_povs_pov ON povs (pov);

CREATE TABLE IF NOT EXISTS likes (
  id         varchar PRIMARY KEY,
  post_id    varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL,
  CONSTRAINT uq_likes_post_user UNIQUE (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id         varchar PRIMARY KEY,
  post_id    varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  created_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_comments_post_id ON comments (post_id);

CREATE TABLE IF NOT EXISTS pov_likes (
  id         varchar PRIMARY KEY,
  pov        varchar NOT NULL,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL,
  CONSTRAINT uq_pov_likes_pov_user UNIQUE (pov, user_id)
);
CREATE INDEX IF NOT EXISTS ix_pov_likes_pov ON pov_likes (pov);

CREATE TABLE IF NOT EXISTS pov_comments (
  id         varchar PRIMARY KEY,
  pov        varchar NOT NULL,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  stance     varchar NOT NULL DEFAULT 'note',
  created_at timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_pov_comments_pov_created ON pov_comments (pov, created_at);
CREATE INDEX IF NOT EXISTS ix_pov_comments_user ON pov_comments (user_id);

CREATE TABLE IF NOT EXISTS follows (
  id          varchar PRIMARY KEY,
  follower_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamp NOT NULL,
  CONSTRAINT uq_follows UNIQUE (follower_id, followee_id)
);
CREATE INDEX IF NOT EXISTS ix_follows_follower ON follows (follower_id);
CREATE INDEX IF NOT EXISTS ix_follows_followee ON follows (followee_id);

-- Saved / clipped posts. Also a strong relevance signal for ranking/ML.
CREATE TABLE IF NOT EXISTS bookmarks (
  id         varchar PRIMARY KEY,
  user_id    varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL,
  CONSTRAINT uq_bookmarks_user_post UNIQUE (user_id, post_id)
);
CREATE INDEX IF NOT EXISTS ix_bookmarks_user ON bookmarks (user_id);
CREATE INDEX IF NOT EXISTS ix_bookmarks_post ON bookmarks (post_id);
