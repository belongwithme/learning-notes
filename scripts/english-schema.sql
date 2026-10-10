CREATE TABLE IF NOT EXISTS english_progress (
  word_id text PRIMARY KEY CHECK (word_id ~ '^[WP][0-9]{3,}$'),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','learning','mastered')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  planned_date text NOT NULL DEFAULT '',
  due_date text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Upgrade existing installations as well as new databases (including W1000).
ALTER TABLE english_progress DROP CONSTRAINT IF EXISTS english_progress_word_id_check;
ALTER TABLE english_progress ADD CONSTRAINT english_progress_word_id_check
  CHECK (word_id ~ '^[WP][0-9]{3,}$');
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

-- One immutable document owns both the report and its complete exercise.
CREATE TABLE IF NOT EXISTS english_bundles (
  id uuid PRIMARY KEY,
  period_kind text NOT NULL CHECK (period_kind IN ('day','week','month')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  cutoff timestamptz NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  content jsonb NOT NULL,
  context jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(period_kind, period_start, version)
);
-- Reuse the existing operation ledger for request recovery, including reused reports.
ALTER TABLE english_operations ADD COLUMN IF NOT EXISTS bundle_id uuid REFERENCES english_bundles(id);
CREATE TABLE IF NOT EXISTS english_practice_events (
  id uuid PRIMARY KEY,
  sequence bigserial UNIQUE,
  bundle_id uuid NOT NULL REFERENCES english_bundles(id),
  kind text NOT NULL CHECK (kind IN ('answer','hint','reveal','flag','feedback','study')),
  question_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE english_practice_events DROP CONSTRAINT IF EXISTS english_practice_events_kind_check;
ALTER TABLE english_practice_events ADD CONSTRAINT english_practice_events_kind_check
  CHECK (kind IN ('answer','hint','reveal','flag','feedback','study'));
CREATE INDEX IF NOT EXISTS english_practice_events_bundle ON english_practice_events(bundle_id, sequence);
CREATE TABLE IF NOT EXISTS english_retests (
  id uuid PRIMARY KEY,
  source_bundle_id uuid NOT NULL REFERENCES english_bundles(id),
  word_id text NOT NULL,
  usage text NOT NULL,
  stage integer NOT NULL CHECK (stage BETWEEN 0 AND 2),
  suggested_date text NOT NULL,
  scheduled_date text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted','skipped')),
  manual_date text NOT NULL DEFAULT '',
  manual_choice text NOT NULL CHECK (manual_choice IN ('keep','suggested','custom')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  completed_bundle_id uuid REFERENCES english_bundles(id),
  completed_at timestamptz,
  UNIQUE(source_bundle_id, word_id)
);
