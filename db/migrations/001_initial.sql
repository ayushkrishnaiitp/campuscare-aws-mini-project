CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','staff')),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  student_id BIGINT NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('Facilities','IT & Wi-Fi','Cleaning','Safety','Other')),
  location TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('Low','Normal','High','Urgent')),
  description TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In progress','Resolved','Closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_status_created_idx ON tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_student_created_idx ON tickets(student_id, created_at DESC);
