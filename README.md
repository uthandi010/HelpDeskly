# HelpDeskly

A customer support ticketing tool — a small Zendesk. A support team gets a public help page
where customers can open a ticket with no account at all, then the team works the queue from a
shared dashboard with real metrics.

## Features

- **Auth** — register/login with JWT, bcrypt password hashing
- **Organizations** — each support team has its own tickets, members, and public help page
- **Roles** — `agent < admin`, enforced server-side on every organization-scoped request (only an
  admin can invite people; any member can work tickets)
- **Ticket queue** — filter by status, see who's assigned, reassign, change priority
- **Threaded replies** — every ticket is a conversation; an agent or the customer replying to a
  resolved/closed ticket automatically reopens it, a common helpdesk convention
- **No-account customer access** — a customer can open a ticket, then check on it and reply later
  using just the ticket link and the email they submitted it with (never by ticket ID alone)
- **Dashboard metrics** — ticket volume over the last 30 days, plus a breakdown by status and
  priority, charted

## Stack

| Layer | Tech |
| --- | --- |
| API | Node.js, Express 5, MongoDB (Mongoose) |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` for password hashing |
| Client | React 19 + TypeScript, React Router, Recharts |
| Tests | Node's built-in test runner + Supertest (37 examples), Vitest + Testing Library (14 examples) |

No paid services are required to run this locally — just a local MongoDB instance.

## Project layout

```
server/   # Express API (models, routes, JWT/bcrypt auth)
client/   # React frontend (agent dashboard + the public support pages)
```

## Running it locally

### API

You need MongoDB running locally (default port 27017 — e.g. `mongod` from the MongoDB Community
Server, or `docker run -p 27017:27017 mongo:7`).

```bash
cd server
npm install
npm start
```

Run the backend tests (uses a separate `helpdeskly_test` database, wiped between test files):

```bash
cd server
npm test
```

### Client

```bash
cd client
cp .env.example .env.local   # adjust VITE_API_BASE_URL if needed
npm install
npm run dev
```

Run the frontend tests:

```bash
cd client
npm test
```

## Why Node's built-in test runner instead of Jest

This project's tests originally ran on Jest, but every MongoDB connection hung under Jest's
sandboxed V8 realm: Jest gives each test file its own `Buffer`/`Uint8Array` globals, and the
MongoDB driver's BSON serializer silently produced a corrupted handshake document when run against
those non-native globals — the server rejected it with `Missing required sub-document 'driver'`.
Node's built-in test runner (`node --test`, stable since Node 20) runs each file as a real Node
process with no VM sandboxing, so the same code works immediately. It also meant one less
dependency. (`--test-concurrency=1` is required: unlike Jest's `--runInBand`, `node --test` runs
files in parallel by default, and every file shares one real MongoDB test database.)

## Notes on the auth design

- Roles live on the **membership** (an `OrganizationMember` document), not the user, so the same
  person could be an agent on one team and the admin of another.
- Every organization-scoped route loads the organization and checks membership before running -
  a non-member gets `403` even with a valid id.
- A ticket route with no organization in its URL (`/api/tickets/:ticketId`) derives the
  organization from the ticket itself before checking membership, the same pattern used for
  cancelling a booking in the BookedIn project in this series.
- A customer looking up or replying to their own ticket is verified by **ticket id + the exact
  email it was opened with** — a ticket id alone is deliberately not enough, and a wrong email
  gets the same 404 as a wrong ticket id, so a guesser can't tell which part was wrong.

## What's intentionally left out

This is a portfolio-scale MVP, not a production helpdesk. A few things that would come next: email
delivery (right now there's no actual email sent — the customer has to save their tracking link),
canned responses, SLA timers, and per-agent workload metrics.
