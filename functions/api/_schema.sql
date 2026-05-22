-- Schema for cookies-in-iran comments
-- Apply locally:  npm run db:schema
-- Apply remotely: npm run db:schema:remote

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS identities (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  lang        TEXT NOT NULL CHECK (lang IN ('de','en','ru','fa')),
  email_hash  TEXT NOT NULL,
  email_enc   TEXT,
  verified_at INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (name, lang)
);
CREATE INDEX IF NOT EXISTS idx_identities_email ON identities (email_hash, lang);

CREATE TABLE IF NOT EXISTS comments (
  id               TEXT PRIMARY KEY,
  thread_id        TEXT NOT NULL,
  lang             TEXT NOT NULL CHECK (lang IN ('de','en','ru','fa')),
  parent_id        TEXT REFERENCES comments(id) ON DELETE SET NULL,
  identity_id      TEXT REFERENCES identities(id) ON DELETE SET NULL,
  display_name     TEXT NOT NULL,
  body             TEXT NOT NULL,
  notify_email_enc TEXT,
  ip_hash          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','hidden','deleted')),
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_identity ON comments (identity_id);

CREATE TABLE IF NOT EXISTS pending_verifications (
  code_hash    TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  email_hash   TEXT NOT NULL,
  name         TEXT NOT NULL,
  lang         TEXT NOT NULL CHECK (lang IN ('de','en','ru','fa')),
  comment_json TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0,
  bounced      INTEGER NOT NULL DEFAULT 0,
  expires_at   INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_expires ON pending_verifications (expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_email ON pending_verifications (email_hash);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  comment_id  TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reason      TEXT,
  ip_hash     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reports_unresolved ON reports (resolved_at, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_comment ON reports (comment_id);

CREATE TABLE IF NOT EXISTS bans (
  id          TEXT PRIMARY KEY,
  ip_hash     TEXT,
  identity_id TEXT REFERENCES identities(id) ON DELETE CASCADE,
  reason      TEXT,
  until       INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bans_ip ON bans (ip_hash);
CREATE INDEX IF NOT EXISTS idx_bans_identity ON bans (identity_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  actor      TEXT NOT NULL,
  action     TEXT NOT NULL,
  target_id  TEXT,
  details    TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);
