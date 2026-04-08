# Rythmify — Backend

> SoundCloud-like music platform · Node.js · Express.js · PostgreSQL · Socket.IO

**Backend Lead:** Omar Hamza
**Backend Members:** Saja Aboulmagd, Alyaa Mohamed, Omar Hamdy, Beshoy Maher

---

## Table of Contents

- [Quick Start](#quick-start)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
- [Design Patterns](#design-patterns)
- [API Reference](#api-reference)
- [Database](#database)
- [Testing](#testing)
- [Code Standards](#code-standards)
- [Scripts](#scripts)
- [Environment Variables](#environment-variables)

---

## Quick Start

### Prerequisites

- Node.js v18+
- PostgreSQL 14+
- A `.env` file (see below)

```bash
# 1. Clone the repo
git clone https://github.com/your-org/rythmify-backend.git
cd rythmify-backend

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Open .env and fill in your values

# 4. Set up the database
createdb rythmify
npm run migrate
npm run seed

# 5. Run in development mode
npm run dev
```

Server starts at: `http://localhost:8080/api/v1`  
Health check: `http://localhost:8080/health`

---

## Tech Stack

### Backend

| Technology | Purpose                             |
| ---------- | ----------------------------------- |
| Node.js    | Runtime environment                 |
| Express.js | Web framework & routing             |
| PostgreSQL | Primary relational database         |
| Socket.IO  | Real-time messaging & notifications |

### Infrastructure

| Service           | Purpose                             |
| ----------------- | ----------------------------------- |
| Cloudinary        | Audio and image file storage        |
| Stripe            | Subscription payments (mocked)      |
| Nodemailer / SMTP | Email verification & password reset |
| Google OAuth 2.0  | Social login                        |

### Tooling

| Tool             | Purpose                    |
| ---------------- | -------------------------- |
| Jest + Supertest | Unit & integration testing |
| ESLint           | Code linting               |
| Prettier         | Code formatting            |
| Nodemon          | Development hot reload     |

---

## Project Structure

```
rythmify-backend/
├── src/
│   ├── config/         # DB, JWT, S3, Stripe, env
│   ├── controllers/    # HTTP request/response handling (12 modules)
│   ├── middleware/     # auth, roles, multer, rate-limiter, error-handler
│   ├── models/         # All PostgreSQL queries (15 entities)
│   ├── routes/         # Express routers (12 modules)
│   ├── services/       # Business logic (12 modules)
│   ├── sockets/        # Socket.IO handlers (messages, notifications)
│   └── utils/          # asyncHandler, api-response, validators, etc.
├── tests/              # Jest test files (12 modules)
├── database/
│   ├── migrations/     # SQL migration files
│   └── seeds/          # Seed data for development
├── app.js              # Express app setup
├── server.js           # HTTP server + Socket.IO bootstrap
├── openapi.yaml        # Full API spec (OpenAPI 3.0.3)
└── .env.example        # Environment variable template
```

---

## Architecture

```
Request
  └── Routes          (apply middleware: auth, rate-limit, multer)
        └── Controllers   (validate input, call service, return response)
              └── Services    (all business logic — no SQL here)
                    └── Models      (all PostgreSQL queries — no SQL outside here)

Real-time (Socket.IO)
  └── sockets/notifications.socket.js   (Module 10)
  └── sockets/messages.socket.js        (Module 9)
```

### Layer Rules

- **No SQL in controllers or services** — all queries go in `models/`
- **No business logic in controllers** — delegate everything to services
- **No `process.env` outside `src/config/env.js`** — all env vars go through there
- **All async route handlers wrapped in `asyncHandler()`** — no uncaught promise rejections

---

## Design Patterns

| Pattern                         | Where Applied                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **MVC (Model–View–Controller)** | Core architecture — models handle data, controllers handle HTTP, services act as the business layer between them                   |
| **Service Layer Pattern**       | All business logic lives in `src/services/` — controllers never contain logic, only delegation                                     |
| **Repository Pattern**          | All database access is encapsulated in `src/models/` — no raw SQL anywhere else in the codebase                                    |
| **Middleware Pattern**          | Cross-cutting concerns (auth, rate limiting, file uploads, error handling) are isolated as Express middleware in `src/middleware/` |
| **Singleton Pattern**           | DB connection pool, Cloudinary client, and Stripe instance are initialised once in `src/config/` and reused across all modules     |

---

## API Reference

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| **Dev Base URL**  | `http://localhost:8080/api/v1`                               |
| **Prod Base URL** | `https://api.rythmify.com/api/v1`                            |
| **Spec**          | `openapi.yaml` — shared with Frontend & Cross-Platform teams |
| **Access Token**  | 15 min TTL · `Authorization: Bearer <token>` header          |
| **Refresh Token** | 7 days TTL · `httpOnly` cookie                               |

### Response Envelope

Every endpoint returns this shape:

```json
{
  "success": true,
  "message": "OK",
  "data": {},
  "meta": {}
}
```

### Rate Limits

| Scope          | Limit            |
| -------------- | ---------------- |
| General API    | 100 req / 15 min |
| Auth endpoints | 5 req / 15 min   |
| File uploads   | 20 req / hour    |

### File Upload Limits

| Type   | Max Size | Accepted Formats    |
| ------ | -------- | ------------------- |
| Audio  | 100 MB   | MP3, WAV, FLAC, AAC |
| Images | 5 MB     | JPG, PNG, WEBP      |

---

## Database

### Setup

```bash
# Create the database
createdb rythmify

# Run all migrations (creates tables and indexes)
npm run migrate

# Seed with development data (optional)
npm run seed
```

### Schema

The database contains 15 entities and 31 relationships. See the full ER diagram in the project proposal document.

Key entities: `users`, `tracks`, `playlists`, `albums`, `comments`, `messages`, `notifications`, `reports`, `refresh_tokens`, `verification_tokens`, `subscription_plans`, `user_subscriptions`, `transactions`, `tags`, `web_profiles`

### Migrations

Migration files live in `database/migrations/` and are numbered sequentially:

```
001_create_users.sql
002_create_tracks.sql
003_create_playlists.sql
...
```

Run `npm run migrate` to apply all pending migrations in order.

---

## Testing

Jest and Supertest are used for unit and integration testing.

```bash
# Run all tests
npm test

# Run a specific module's tests
npx jest tests/auth.test.js

# Run with coverage report
npx jest --coverage
```

### Coverage Target

| Metric     | Target |
| ---------- | ------ |
| Statements | 95%+   |
| Branches   | 90%+   |
| Functions  | 95%+   |
| Lines      | 95%+   |

### Test Structure

Each module has a corresponding test file in `/tests` that mirrors the source structure:

```
tests/
├── auth.test.js
├── users.test.js
├── tracks.test.js
└── ...
```

Tests cover: successful responses, validation errors, auth failures, edge cases, and rate limiting behaviour.

---

## Code Standards

- **ESLint + Prettier** enforced on every PR — run `npm run lint` before pushing
- **`async/await`** for all async operations — no `.then()` chains
- **`asyncHandler()`** wraps every route handler — centralised error catching
- **camelCase** for variables and functions · **PascalCase** for classes · **kebab-case** for files
- **snake_case** for all database tables and columns

---

## Scripts

```bash
npm run dev        # Start with nodemon (hot reload)
npm start          # Production start
npm test           # Run Jest test suite
npm run lint       # ESLint check
npm run format     # Prettier format all files in src/
npm run migrate    # Run database migrations
npm run seed       # Seed database with development data
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. Never commit `.env` to git.

| Variable            | Description                              |
| ------------------- | ---------------------------------------- |
| `PORT`              | Server port (default: 8080)              |
| `DB_*`              | PostgreSQL connection details            |
| `JWT_SECRET`        | Secret key for signing tokens            |
| `CLOUDINARY_*`      | File storage credentials                 |
| `STRIPE_SECRET_KEY` | Mocked payment key (use Stripe test key) |
| `SMTP_*`            | Email service for verification emails    |
| `GOOGLE_CLIENT_*`   | Google OAuth credentials                 |
