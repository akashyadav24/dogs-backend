# 🐕 Dogs Backend — REST API

A **Node.js + Express + MongoDB** REST API for viewing and editing dog breeds and
their sub-breeds. It is the **backend** half of the Dogs Web App, built for the
Hutchison "Dogs Web API" code test.

The React frontend lives in a separate repository and calls this API over HTTP
(CORS is enabled): **[dogs-frontend »](https://github.com/akashyadav24/dogs-frontend)**

- **Live API:** https://p01--dogs-backend--tkjgvp892kwn.code.run
- **Health check:** [`/api/health`](https://p01--dogs-backend--tkjgvp892kwn.code.run/api/health)

---

## Contents
- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Data model & persistence](#data-model--persistence)
- [Authentication & per-user data](#authentication--per-user-data)
- [API reference](#api-reference)
- [Run locally](#run-locally)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [Deploy](#deploy)
- [Project structure](#project-structure)

## What it does

The supplied `dogs.json` maps breeds to sub-breeds, e.g. `"bulldog": ["boston", "french"]`.
This API exposes full **CRUD** over breeds and their sub-breeds, with data stored in
MongoDB so changes **persist**.

- **Public reads:** anyone can browse the base breed list without an account.
- **Authenticated writes:** creating, updating and deleting requires an account.
  Each user gets their **own private copy** of the list, so their edits are theirs
  alone (see [Authentication & per-user data](#authentication--per-user-data)).

## Tech stack

- **Node.js + Express** — HTTP server and routing
- **MongoDB + Mongoose** — persistence
- **JSON Web Tokens (JWT)** + **bcrypt** — auth
- **Jest + Supertest + mongodb-memory-server** — tests (no external DB needed)
- **Docker** — containerised deploy

## Architecture

```
                         ┌──────────────────────────┐
 React frontend  ──────▶ │  Express API (this repo)  │ ──────▶  MongoDB (Atlas)
 (separate repo)  HTTP   │  /api/auth   /api/breeds  │  Mongoose   users, breeds
                         └──────────────────────────┘
```

The frontend is deployed separately and points at this API via `VITE_API_BASE_URL`.
CORS is enabled so the cross-origin browser requests are allowed.

## Data model & persistence

Two MongoDB collections:

- **`users`** — `{ email (unique, lowercased), passwordHash }`
- **`breeds`** — `{ userId, name (lowercased), subBreeds: [String], createdAt, updatedAt }`
  with a **compound unique index on `(userId, name)`** — a breed name is unique
  *per user*, so different users can each have (and independently edit) a "pug".

Because data lives in MongoDB (not in memory or a file), changes **persist** across
restarts, redeploys and browser sessions — satisfying the brief's requirement that a
deleted breed stays deleted.

## Authentication & per-user data

**Username/password** auth using **JWT**. Register or log in to receive a **short-lived
access token** (sent as `Authorization: Bearer <token>` on write requests) and a
**long-lived refresh token**.

**Refresh-token rotation:** access tokens expire quickly (15 min); the client silently
exchanges the refresh token at `POST /api/auth/refresh` for a new pair. Each refresh
token is single-use — using it invalidates it and issues a new one, and it can be
revoked at `POST /api/auth/logout`. Tokens are stored hashed with a TTL index.

- **Reads are public.** Anonymous requests to `GET /api/breeds` return a read-only
  **base list** seeded from `dogs.json`.
- **Writes require a token.** On registration, a user is given their own copy of the
  base breeds; every create/update/delete is scoped to `req.userId`, so one user's
  changes never affect another's.

Credentials: **username** (3–30 characters; letters, numbers and `. _ -`) and a
**password** of **minimum 6 characters, no complexity rules** (no required
uppercase/number/symbol).

## API reference

Base path: `/api`. Bodies and responses are JSON. Errors use a consistent envelope:
`{ "error": { "message": "..." } }` with appropriate status codes (`400` invalid input,
`401` unauthenticated, `404` not found, `409` duplicate).

### Auth (public)

| Method | Endpoint             | Body                       | Description                                        |
|--------|----------------------|----------------------------|----------------------------------------------------|
| `POST` | `/api/auth/register` | `{ username, password }`   | Create account → `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/login`    | `{ username, password }`   | Log in → `{ accessToken, refreshToken, user }`     |
| `POST` | `/api/auth/refresh`  | `{ refreshToken }`         | Rotate → new `{ accessToken, refreshToken, user }` |
| `POST` | `/api/auth/logout`   | `{ refreshToken }`         | Revoke the refresh token (204)                     |
| `GET`  | `/api/auth/me`       | —                          | Current user (requires access token)               |

### Breeds

Reads are public; **writes require `Authorization: Bearer <token>`**.

| Method   | Endpoint                              | Auth | Description                     |
|----------|---------------------------------------|:----:|---------------------------------|
| `GET`    | `/api/health`                         |  –   | Health check                    |
| `GET`    | `/api/breeds`                         |  –   | List breeds (`?search=` filter) |
| `GET`    | `/api/breeds/:name`                   |  –   | Get one breed                   |
| `POST`   | `/api/breeds`                         |  ✔   | Create `{ name, subBreeds? }`   |
| `PUT`    | `/api/breeds/:name`                   |  ✔   | Rename / replace sub-breeds     |
| `DELETE` | `/api/breeds/:name`                   |  ✔   | Delete a breed                  |
| `POST`   | `/api/breeds/:name/sub-breeds`        |  ✔   | Add `{ subBreed }`              |
| `PUT`    | `/api/breeds/:name/sub-breeds/:sub`   |  ✔   | Rename a sub-breed              |
| `DELETE` | `/api/breeds/:name/sub-breeds/:sub`   |  ✔   | Delete a sub-breed              |

### Examples

```bash
# Public: list breeds
curl https://p01--dogs-backend--tkjgvp892kwn.code.run/api/breeds

# Register and capture the token
TOKEN=$(curl -s -X POST .../api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"me","password":"secret123"}' | jq -r .accessToken)

# Authenticated: create a breed
curl -X POST .../api/breeds \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"shepherd","subBreeds":["german"]}'

# Authenticated: delete a breed
curl -X DELETE .../api/breeds/pug -H "Authorization: Bearer $TOKEN"
```

## Run locally

Requires **Node 18+** and a **MongoDB** connection string (local Docker/mongod or a
free MongoDB Atlas cluster).

```bash
cp .env.example .env      # then set MONGODB_URI (include /dogs) and JWT_SECRET
npm install
npm run dev               # http://localhost:4000  (nodemon, live reload)
# or: npm start
```

Verify: `curl http://localhost:4000/api/health` → `{"status":"ok",...}`

> Quick local MongoDB via Docker:
> `docker run -d -p 27017:27017 --name dogs-mongo mongo:7`
> then `MONGODB_URI=mongodb://127.0.0.1:27017/dogs`

## Environment variables

See [`.env.example`](./.env.example).

| Variable      | Required | Description                                                     |
|---------------|:--------:|-----------------------------------------------------------------|
| `MONGODB_URI` |   yes    | Mongo connection string **including the `/dogs` database name** |
| `JWT_SECRET`  |   yes    | Secret used to sign access tokens — a long random string        |
| `CORS_ORIGIN` |    no    | Allowed frontend origin(s), comma-separated (e.g. your Vercel URL). Unset = allow any (dev). |
| `PORT`        |    no    | Listen port (default `4000`; most hosts set this)               |
| `NODE_ENV`    |    no    | `development` / `production`                                     |

> **Atlas note:** put the database name in the path *before* the query string:
> `mongodb+srv://user:pass@cluster.mongodb.net/dogs?retryWrites=true&w=majority`

## Tests

Automated API tests run against an **in-memory MongoDB** (no external database
required), covering auth, public reads, protected writes, full CRUD and per-user
isolation:

```bash
npm test
```

## Deploy

The included [`Dockerfile`](./Dockerfile) builds a small `node:20-alpine` image.
Any container host works (this project is deployed on **Northflank**, free tier).

- **Docker host:** build from `Dockerfile`; expose port `4000`; health check `/api/health`.
- **Native Node host:** build `npm install`, start `npm start`.

Set **`MONGODB_URI`** (with `/dogs`) and **`JWT_SECRET`** in the host's environment,
and **`CORS_ORIGIN`** to your deployed frontend URL (to restrict cross-origin access).
Then point the frontend's `VITE_API_BASE_URL` at this service's public URL.

> Free-tier hosts may cold-start after inactivity; the first request can take ~30–50s.

**CI:** GitHub Actions ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs the
test suite on every push and pull request.

## Project structure

```
dogs-backend/
├── Dockerfile              # container build
├── dogs.json               # seed data (base breed list)
├── .env.example
├── package.json
└── src/
    ├── index.js            # bootstrap: connect DB, sync indexes, listen
    ├── app.js              # express app: CORS, routes, error handling
    ├── db.js               # mongoose connection
    ├── seed.js             # base list + per-user seeding
    ├── models/
    │   ├── user.js
    │   ├── breed.js        # compound unique index (userId, name)
    │   └── refreshToken.js # hashed refresh tokens, TTL index
    ├── routes/
    │   ├── auth.js
    │   └── breeds.js       # public reads, protected writes
    ├── controllers/
    │   ├── auth.controller.js
    │   └── breeds.controller.js
    └── middleware/
        ├── auth.js         # requireAuth + optionalAuth
        ├── validate.js     # name normalisation/validation
        └── errorHandler.js # ApiError + JSON error envelope
└── tests/
    └── breeds.test.js
```
