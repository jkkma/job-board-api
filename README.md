# Job Board API

A REST API for a job board, built with Express 5, Prisma, and PostgreSQL. Employers post jobs, applicants apply to them, and employers accept or reject the applications they receive. Authentication is JWT-based with two roles: `EMPLOYER` and `APPLICANT`.

## Tech Stack

| Concern             | Choice                                                      |
| ------------------- | ----------------------------------------------------------- |
| Runtime             | Node.js (CommonJS)                                          |
| Framework           | Express 5                                                   |
| Database            | PostgreSQL via Prisma ORM 6                                 |
| Auth                | `jsonwebtoken` (HS256, 7-day expiry) + `bcryptjs` (cost 10) |
| Validation          | Zod 4                                                       |
| Hardening / logging | `helmet`, `cors`, `morgan`                                  |

## Project Structure

```
prisma/
  schema.prisma            # User, Job, Application models + Role/Status enums
prisma.config.ts           # Prisma CLI config (schema path, migrations dir, datasource)
src/
  server.js                # App entry: middleware, route mounting, listener
  routes/
    auth.js                # /api/auth
    jobs.js                # /api/jobs
    applications.js        # /api/applications
  controllers/
    authController.js      # register, login
    jobController.js       # CRUD + search, with ownership checks
    applicationController.js
  middleware/
    auth.js                # authenticateToken — verifies Bearer token, sets req.user
    validate.js            # validate(schema) — Zod body validation
  validations/
    schemas.js             # All request-body schemas
```

## Getting Started

### Prerequisites

- Node.js 18+
- A reachable PostgreSQL database

### Setup

```bash
git clone https://github.com/jkkma/job-board-api.git
cd job-board-api
npm install
```

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/job_board?schema=public"
JWT_SECRET="replace-with-a-long-random-string"
PORT=5000
```

`DATABASE_URL` and `JWT_SECRET` are both required — the server will start without `JWT_SECRET`, but every token operation will throw.

Apply the schema and generate the Prisma client:

```bash
npx prisma migrate dev --name init
```

> `prisma/migrations/` is gitignored, so a fresh clone has no migration history. Use `migrate dev` as above to create it, or `npx prisma db push` if you'd rather skip migrations entirely.

### Run

```bash
npm run dev     # nodemon, reloads on change
npm start       # plain node
```

Server listens on `http://localhost:5000` (or `PORT`). `GET /` returns a health message.

## Data Model

**User** — `id` (uuid), `email` (unique), `password` (hashed), `role` (`EMPLOYER` | `APPLICANT`, default `APPLICANT`), `name?`, timestamps. Has many jobs (as employer) and many applications (as applicant).

**Job** — `id` (uuid), `title`, `description`, `location?`, `salary?` (string), `type?` (free-form, e.g. `full-time`), `isActive` (default `true`), `employerId`. Cascade-deletes with its employer.

**Application** — `id` (uuid), `coverLetter?`, `status` (`PENDING` | `ACCEPTED` | `REJECTED`, default `PENDING`), `applicantId`, `jobId`. `@@unique([applicantId, jobId])` prevents duplicate applications to the same job.

## API Reference

Base URL: `http://localhost:5000`

Protected routes require an `Authorization: Bearer <token>` header. Missing token → `401`; invalid or expired → `403`.

### Auth — `/api/auth`

| Method | Path        | Auth | Description                                                                                                                                                      |
| ------ | ----------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/register` | —    | Create an account. Body: `email`, `password` (min 6), `role` (`EMPLOYER` \| `APPLICANT`), `name?`. Returns `201` with the new user; `400` if the email is taken. |
| `POST` | `/login`    | —    | Body: `email`, `password`. Returns a JWT plus the user; `400` on bad credentials.                                                                                |

The token payload carries `{ id, email, role }` and expires in 7 days.

### Jobs — `/api/jobs`

| Method   | Path   | Auth     | Description                                                                                                                                      |
| -------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/`    | —        | List active jobs, newest first. Query params: `search` (case-insensitive match on title or description), `location` (case-insensitive contains). |
| `GET`    | `/:id` | —        | Fetch one job with employer name and email. `404` if not found.                                                                                  |
| `POST`   | `/`    | ✅       | Create a job owned by the caller. Body: `title` (min 3), `description` (min 10), `location?`, `salary?`, `type?`.                                |
| `PUT`    | `/:id` | ✅ owner | Update any subset of the above plus `isActive`. `403` if the caller isn't the job's employer.                                                    |
| `DELETE` | `/:id` | ✅ owner | Delete the job (and its applications, via cascade). `403` if not the owner.                                                                      |

### Applications — `/api/applications`

| Method  | Path          | Auth         | Description                                                                                                                                                                     |
| ------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/`           | ✅ applicant | Apply to a job. Body: `jobId` (uuid), `coverLetter?`. `403` unless the caller's role is `APPLICANT`; `404` if the job is missing or inactive; `400` on a duplicate application. |
| `GET`   | `/my`         | ✅           | The caller's own applications, newest first, each with basic job info.                                                                                                          |
| `GET`   | `/job/:id`    | ✅ owner     | All applications for one of the caller's jobs, with applicant details. `403` if the caller doesn't own the job.                                                                 |
| `PATCH` | `/:id/status` | ✅ owner     | Body: `status` (`ACCEPTED` \| `REJECTED`). `403` unless the caller owns the job the application targets.                                                                        |

### Validation Errors

Any request whose body fails its Zod schema returns `400` in this shape:

```json
{
  "error": "Validation failed",
  "issues": [{ "path": "password", "message": "Password must be at least 6 characters" }]
}
```

## Example Flow

```bash
# 1. Register an employer
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"hire@acme.com","password":"secret123","role":"EMPLOYER","name":"Acme"}'

# 2. Log in and capture the token
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hire@acme.com","password":"secret123"}' | jq -r .token)

# 3. Post a job
curl -X POST http://localhost:5000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Backend Engineer","description":"Build and maintain our API layer.","location":"Remote","salary":"$120k","type":"full-time"}'

# 4. Browse jobs (no auth needed)
curl "http://localhost:5000/api/jobs?search=backend&location=remote"

# 5. As an APPLICANT, apply
curl -X POST http://localhost:5000/api/applications \
  -H "Authorization: Bearer $APPLICANT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jobId":"<job-uuid>","coverLetter":"I would love to join."}'
```

## Scripts

| Command                  | Action                       |
| ------------------------ | ---------------------------- |
| `npm run dev`            | Start with nodemon           |
| `npm start`              | Start with node              |
| `npx prisma studio`      | Browse the database in a GUI |
| `npx prisma migrate dev` | Create and apply a migration |
| `npx prisma generate`    | Regenerate the Prisma client |

## License

ISC
