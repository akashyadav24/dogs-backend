# 🐕 Dogs Backend — REST API

Node.js + Express + MongoDB REST API for managing dog breeds and their sub-breeds.
This is the **backend** half of the Dogs Web App; the React frontend lives in a
separate repository and calls this API over HTTP (CORS is enabled).

Seed data (`dogs.json`) is loaded into MongoDB on first run.

## API

Base path: `/api`. Responses are JSON; errors use `{ "error": { "message" } }`.

| Method   | Endpoint                              | Description                          |
|----------|---------------------------------------|--------------------------------------|
| `GET`    | `/api/health`                         | Health check                         |
| `GET`    | `/api/breeds`                         | List breeds (`?search=` filter)      |
| `GET`    | `/api/breeds/:name`                   | Get one breed                        |
| `POST`   | `/api/breeds`                         | Create `{ name, subBreeds? }`        |
| `PUT`    | `/api/breeds/:name`                   | Rename / replace sub-breeds          |
| `DELETE` | `/api/breeds/:name`                   | Delete a breed                       |
| `POST`   | `/api/breeds/:name/sub-breeds`        | Add `{ subBreed }`                   |
| `PUT`    | `/api/breeds/:name/sub-breeds/:sub`   | Rename a sub-breed                   |
| `DELETE` | `/api/breeds/:name/sub-breeds/:sub`   | Delete a sub-breed                   |

## Run locally

Requires **Node 18+** and a **MongoDB** connection string (local or Atlas).

```bash
cp .env.example .env     # then set MONGODB_URI (include /dogs in the path)
npm install
npm run dev              # http://localhost:4000  (nodemon, live reload)
# or: npm start
```

Check it: `curl http://localhost:4000/api/health`

## Tests

Runs against an in-memory MongoDB (no external database needed):

```bash
npm test
```

## Environment variables

| Variable      | Required | Description                                                        |
|---------------|----------|--------------------------------------------------------------------|
| `MONGODB_URI` | yes      | Mongo connection string **including the `/dogs` database name**    |
| `PORT`        | no       | Listen port (default `4000`; hosts usually set this)               |
| `NODE_ENV`    | no       | `development` / `production`                                       |

## Deploy

Any Node host works. Two common options:

- **Native (no Docker):** build command `npm install`, start command `npm start`.
- **Docker:** the included [`Dockerfile`](./Dockerfile) builds a small `node:20-alpine` image.

Set `MONGODB_URI` (with `/dogs`) in the host's environment. Then point the frontend's
`VITE_API_BASE_URL` at this service's public URL.

> Free-tier hosts (e.g. Render, Koyeb) may cold-start after inactivity; the first
> request can take ~30–50s.
