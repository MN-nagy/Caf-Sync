# CaféSync

Real-time ordering and kitchen management system for cafés. Customers order via QR code (dine-in) or for pickup, kitchen staff manage the order queue on a live display, and the manager gets an admin dashboard for the menu, tables, stats, and store settings — all synced instantly over WebSockets.

> Status: v1.0.0

## Features

**Customer ordering**
- Pickup or dine-in (via table selection) ordering flow
- Live menu with categories, sale pricing, and out-of-stock handling
- InstaPay-based payment confirmation flow with WhatsApp receipt verification

**Kitchen display**
- Two-factor device flow: manager device enrollment (email/password) + shift PIN (barista)
- Separate live queues for pickup orders (Pending → Preparing → Ready → Picked Up) and table orders (Preparing → Ready → Complete)
- Real-time updates via Socket.IO, with automatic re-sync on reconnect

**Admin dashboard**
- Sales analytics: daily orders/revenue, top-selling items, peak hours
- Menu management: edit pricing/description/category, add or archive items
- Store settings: manage tables (add/remove/toggle active), change the kitchen PIN

## Tech stack

**Frontend** — Next.js (App Router), React, TypeScript, Tailwind CSS, Framer Motion, Socket.IO client

**Backend** — Express, TypeScript, Drizzle ORM, PostgreSQL, Socket.IO, JWT (cookie-based auth), Zod (validation), bcrypt

## Architecture

```
┌─────────────┐        HTTPS / cookies        ┌──────────────┐
│  Next.js     │ ─────────────────────────────▶│   Express     │
│  (frontend)  │◀───────────────────────────── │   (API)       │
│              │                                │               │
│  - /menu     │        WebSocket (kitchen NS)  │  - /api/menu  │
│  - /setup    │◀──────────────────────────────▶│  - /api/orders│
│  - /admin    │                                │  - /api/auth  │
│  - /kitchen  │                                │  - /api/admin │
└─────────────┘                                └───────┬──────┘
                                                          │
                                                  ┌───────▼──────┐
                                                  │  PostgreSQL   │
                                                  │  (Drizzle)    │
                                                  └───────────────┘
```

- Public routes: `/menu`, `/setup` (table selection) — no auth required
- Staff routes: `/kitchen` — gated by a `deviceToken` (30-day, manager-issued) + `shiftToken` (24h, PIN-issued)
- Manager routes: `/admin` — gated by `deviceToken` with `role: "manager"`
- Order-touching state changes (status updates, phone number edits) are re-validated server-side; pricing is always recomputed from the database, never trusted from the client

## Getting started

### Prerequisites
- Node.js 20+
- A PostgreSQL database (e.g. [Neon](https://neon.tech) for local/dev)

### Backend setup
```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, CLIENT_URL
npx drizzle-kit push   # apply schema
npx tsx src/db/seed.ts # load sample data + a test manager account
npm run dev
```

### Frontend setup
```bash
cd frontend
npm install
cp .env.example .env   # fill in NEXT_PUBLIC_API_URL
npm run dev
```

### Environment variables

**Backend**
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign auth tokens |
| `CLIENT_URL` | Frontend origin, for CORS + Socket.IO |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (defaults to 3001) |

**Frontend**
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |

## Project structure

```
backend/
  src/
    db/           # Drizzle schema, seed script, connection
    controllers/  # Route handlers
    routes/       # Express routers
    middleware/   # Auth middleware (device/shift/manager)
    types/        # Shared TS types (e.g. Express request augmentation)
    index.ts      # App entry point, Socket.IO setup

frontend/
  src/
    app/          # Next.js routes (menu, setup, admin, kitchen)
    components/   # Client components (MenuClient, KitchenClient, AdminClient, etc.)
```

## License

See [LICENSE](./LICENSE)..
