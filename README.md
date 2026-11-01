# CampusCare Cloud

CampusCare is a small Node.js/Express and PostgreSQL campus maintenance tracker for a four-person cloud-computing mini-project. Students submit facilities or service tickets with category, location, priority, description, and an optional photo. Staff filter the queue, update status, and view simple ticket counts.

## Run locally with Docker Compose

Requirements: Docker Engine, the Docker Compose v2 plugin, Node.js 20+ on the host, and Python 3 for the optional recovery test.

```sh
cp .env.example .env  # optional for local Compose; change SESSION_SECRET for any shared environment
docker compose up --build -d
docker compose --profile seed run --rm seed
npm run test:smoke
sudo python3 scripts/measure-recovery.py
```

Open `http://localhost:3000`. Local demo accounts created by the seed command:

- Student: `student@campus.edu` / `campus123`
- Staff: `staff@campus.edu` / `campus123`

The database schema migrates on app startup. The seed command inserts sample users and tickets only when the relevant tables are empty. Stop the stack with `docker compose down`; named database and upload volumes remain. Remove local data with `docker compose down -v`.

> Demo credentials and the Compose database password are for development only. Replace them and set a high-entropy `SESSION_SECRET` before deployment. Do not expose this Compose configuration to the public internet as-is.

## Run without Docker

Requires Node.js 20+ and a PostgreSQL database. Copy `.env.example` to `.env`, configure `DATABASE_URL`, then run:

```sh
npm install
npm test
npm start
```

The app runs the initial SQL migration on startup. Seed sample users/tickets with `npm run seed`. `npm run dev` starts Node's watch mode. Do not run the seed command against a production database.

## Storage and AWS notes

Uploads are stored locally under `UPLOAD_DIR` (default `./uploads`) in development. JPEG, PNG, or WebP images up to 5 MB are accepted. An optional S3 adapter is included; it requires an existing private bucket, an approved AWS region, and AWS credentials supplied through the normal AWS credential chain (for example, an EC2 instance role). The S3 adapter was not exercised in this local test. This project does not create AWS resources, configure IAM, or deploy itself.

## Security and limitations

- Student/staff authorization is enforced in the application; staff-only status changes and student record visibility are checked server-side.
- Includes field allow-lists and length checks, parameterized SQL, bcrypt password hashes, login rate limiting, HTTP security headers, an httpOnly/same-site session cookie, and upload size/type constraints.
- Production needs a strong `SESSION_SECRET`, HTTPS, secure cookies, managed secrets, database backups, a shared/persistent session store, and upload-content inspection. The default Express memory session store is for this mini-project/Compose demo and is not production-ready.
- File validation currently relies on the browser-supplied MIME type; production should check file signatures and scan content. Account registration, password reset, email notifications, and a staff directory are out of scope.

## API summary

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/dashboard` (student's own counts / staff's overall counts)
- `GET /api/tickets?status=Open` (optional validated status filter)
- `POST /api/tickets` (multipart form: `category`, `location`, `priority`, `description`, optional `photo`)
- `PATCH /api/tickets/:id/status` (staff only; JSON `{ "status": "In progress" }`)
- `GET /api/health`

## Local verification and current status

- `npm test`: **4/4 unit tests passed**.
- `npm run test:smoke`: **11/11 workflow checks passed**, including student/staff login, ticket plus photo submission, role enforcement, staff filtering/status update, dashboard counts, and local photo retrieval.
- `sudo python3 scripts/measure-recovery.py`: three local Docker Compose app-process crash trials passed after Docker's restart count increased; TTRs **1.378 s**, **1.427 s**, and **1.616 s** (median **1.427 s**, maximum **1.616 s**). The timing is from process SIGKILL to the first successful `/api/health` response after a verified container restart. It is a local test only—not an AWS measurement, production guarantee, or availability SLA.
- PostgreSQL remained healthy and retained ticket rows after the app-container restarts. AWS TTR, CloudWatch log collection, and S3 uploads remain untested because no AWS resources were provisioned.
- Public source repository: https://github.com/ayushkrishnaiitp/campuscare-aws-mini-project
- This repository contains the CampusCare application source; the source upload is separate from deployment.
- Railway is planned as the first host and AWS as a later phase. Neither environment is deployed, no application URL is live, and no AWS resources have been provisioned.

Detailed local recovery output is in `test-results/local-docker-recovery.json`.
