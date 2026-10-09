CREATE TABLE IF NOT EXISTS english_progress (
  word_id text PRIMARY KEY CHECK (word_id ~ '^[WP][0-9]{3}$'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','learning','mastered')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  planned_date text NOT NULL DEFAULT '',
  due_date text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS english_reviews (
  id uuid PRIMARY KEY,
  word_id text NOT NULL REFERENCES english_progress(word_id),
  result text NOT NULL CHECK (result IN ('forgot','vague','remembered')),
  studied_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS english_reviews_date ON english_reviews(studied_at DESC);
CREATE TABLE IF NOT EXISTS english_operations (
  id uuid PRIMARY KEY,
  payload_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS english_login_attempts (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
