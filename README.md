# Work Project Management Tool

A field service and commissioning management app for tracking HVAC/cooling system installations, service tickets, scheduling, and supply chain.

## Features

**Sites & Assets**
- Manage sites, units, and SyCool cooling systems
- Track unit commissioning status and levels
- Import units from CSV; import Astea data via the included Python script
- Component and material tracking per unit

**Service & Support**
- Customer support (CS) tickets with XML import and scope-of-work documentation
- General issue/ticket tracking with CxAlloy import support
- Warranty claim management
- Issue-to-service-line linking

**Operations**
- Job scheduling and technician dispatch
- Contractor and site contact management
- Site documents, forms, and job number tracking
- Notes (with email PDF import), todos, and campaigns

**Supply Chain & Reporting**
- Bill of Materials (BOM) with component search
- Master Scope of Work (MSOW) draft management
- Reports view

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15, TypeScript |
| Database | PostgreSQL via Supabase |
| Auth | JWT + bcrypt |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- A [Supabase](https://supabase.com/) project

### Setup

```bash
# 1. Configure environment
cp worky-next/.env.example worky-next/.env
# Fill in DATABASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY, JWT_SECRET

# 2. Install dependencies
cd worky-next && npm install

# 3. Start the development server
npm run dev
```

The app runs at `http://localhost:3000`.

## Project Structure

```
worky-next/           Next.js 15 app (frontend + API routes)
  src/
    app/              Pages and API routes
    components/       Shared UI components
    contexts/         React context providers
    lib/              Auth, DB, and storage utilities
    pages-impl/       Page implementation components
    types/            TypeScript types
```

## License

MIT
