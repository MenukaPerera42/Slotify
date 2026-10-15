<p align="center">
  <img src="public/branding/slotify-logo.png" alt="Slotify" width="360" />
</p>

# Slotify — Resource Reservation Management System

A full-stack, enterprise-grade resource reservation management system developed for the **PrimeWave Lab Software Engineering Internship Technical Assessment**.

Slotify helps teams reserve shared rooms, workspaces, and equipment. Members can request and manage bookings; administrators manage resources, departments, approvals, and office schedules. PostgreSQL protects against conflicting reservations.

## Demo Admin Credentials

| Field | Value |
| --- | --- |
| Email | `admin@gmail.com` |
| Password | `admin@123` |

These **assessment demo credentials** were verified against the configured local demo database on 2026-10-15 and signed in successfully at `http://localhost:3000`. They have **not** been verified against the separate Neon staging Preview; its accounts are different. Do not assume this login works in another deployment.

No working public deployment URL is verified for this repository. The earlier Vercel staging Preview now returns HTTP 410, so it is not listed as a live demo. The repository's GitHub URL has not been configured in this README.

---

## 1. System Overview & Architecture

### Core Engineering Principles
- **Clean Architecture & Separation of Concerns:** Clear boundary separation between Presentation, Feature Modules, Domain Logic, and Data Access layers.
- **Feature-Driven Modular Design:** Encapsulated features (`resources`, `reservations`) housing their own business actions, components, hooks, and schemas.
- **Transactional Integrity:** Defensive database-level constraint handling and application-layer conflict detection for robust scheduling guarantees.
- **Strict Typing & Server-side Validation:** End-to-end type safety leveraging TypeScript strict mode and Zod runtime schema validation.

### Directory Structure
```
Slotify/
├── prisma/
│   └── schema.prisma         # Database schema & Prisma client definitions (PostgreSQL)
├── public/                   # Static assets & icons
├── src/
│   ├── app/                  # Next.js App Router (Layouts, route handlers, error boundaries)
│   │   ├── globals.css       # Tailwind CSS design system tokens
│   │   ├── layout.tsx        # Root HTML layout with font configuration
│   │   └── page.tsx          # Application entry landing / welcome page
│   ├── components/           # Shared, domain-agnostic UI primitives (shadcn/ui patterns)
│   │   └── ui/               # Modular UI components (buttons, dialogs, badges, inputs)
│   ├── features/             # Business domain feature modules
│   │   ├── resources/        # Resource catalog, category filters, and asset cards
│   │   └── reservations/     # Booking flows, time-slot pickers, and timeline views
│   ├── lib/                  # Shared utilities and singleton clients
│   │   └── utils.ts          # Class merging utility (clsx + tailwind-merge)
│   └── types/                # Ambient and domain TypeScript interfaces
│       └── next.d.ts         # Framework module declarations
├── .env.example              # Template for environment variables
├── .gitignore                # Version control ignore rules
├── .prettierrc               # Prettier code formatting rules
├── eslint.config.mjs         # ESLint configuration
├── next.config.ts            # Next.js configuration
├── package.json              # Project scripts and dependency declarations
├── tsconfig.json             # TypeScript compiler options (strict mode enabled)
└── README.md                 # Project documentation
```

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | High-performance React Server Components, server actions, and streaming. |
| **Language** | TypeScript (Strict Mode) | Full type-safety across routes, business logic, and database schemas. |
| **Styling** | Tailwind CSS | Modern utility-first CSS using CSS variables for theme flexibility. |
| **Icons & UI** | Lucide React | Consistent, accessible iconography. |
| **Validation** | Zod | Runtime schema validation across server actions and client forms. |
| **ORM & DB** | Prisma ORM + PostgreSQL | Type-safe queries, migration control, and transactional booking locks. |

---

## 3. Local Setup & Getting Started

### Prerequisites
- **Node.js**: `v20.9.0` or later
- **pnpm**: `v10` or later
- **PostgreSQL**: `v14+`

### Installation
1. From your local clone, navigate into the workspace:
   ```bash
   cd Slotify
   ```

2. Copy the environment configuration:
   ```bash
   cp .env.example .env
   ```
   *(Set `DATABASE_URL` and `AUTH_URL` to your local values. Run `npm run db:setup-demo` to fill missing secrets in the ignored `.env` without printing them.)*

3. Install project dependencies:
   ```bash
   pnpm install
   ```

---

## 4. Development Scripts

- **`npm run dev`**: Start the Next.js development server on `http://localhost:3000`.
- **`npm run build`**: Create an optimized production build.
- **`npm run start`**: Serve the production build locally.
- **`npm run lint`**: Execute ESLint rules check across the codebase.
- **`npm run typecheck`**: Run static TypeScript analysis with `--noEmit`.
- **`npm run format`**: Run Prettier code formatting.
- **`npm run db:migrate`**: Apply Prisma migrations to the PostgreSQL database.
- **`npm run db:client:refresh`**: Regenerate Prisma Client, report migration status, and remind you to restart Next.js. It does not apply migrations or change data.
- **`npm run db:seed`**: Execute repeatable database seeder (`prisma/seed.ts`).

After changing `prisma/schema.prisma`, stop the running Next.js dev server, apply any reviewed migration separately, run `npm run db:client:refresh`, and start `npm run dev` again. A running dev process can retain an older Prisma Client model even when the generated files on disk are current. If `PrismaClientValidationError` reports an unknown field that is present in the schema and generated Client, stop that project's Next.js process, remove its generated `.next` output, regenerate the Client, and restart. Do not remove fields from queries or reset the database to work around a stale runtime.

---

## 5. Development Roadmap & Implementation Status

- [x] **Stage 1 — Project Foundation** *(Completed)*
  - Next.js App Router initialization with TypeScript strict mode
  - Tailwind CSS setup with accessible SaaS design tokens
  - Foundational packages (`zod`, `lucide-react`, `prisma`, `clsx`, `tailwind-merge`)
  - Clean feature-oriented modular architecture
  - Tooling, `.env.example`, `.prettierrc`, and `.gitignore` setup
  - Verification across type checking, linting, build, and local server startup
- [x] **Stage 2 — Database Architecture & Domain Models** *(Completed)*
  - PostgreSQL domain models with UUID primary keys (`User`, `ResourceCategory`, `Resource`, `Reservation`)
  - Check constraints (`startTime < endTime`) and GiST exclusion constraints (`no_overlap_blocking_excl`)
  - Initial migration (`20261013171759_init`) and reusable Prisma singleton client (`src/lib/prisma.ts`)
  - Idempotent database seeder (`prisma/seed.ts`) with demo users, categories, resources, and sample bookings
  - Database architecture & ER diagram documentation (`docs/database-architecture.md`)
- [x] **Stage 3 — Resource Management Feature & Application Shell** *(Completed)*
  - Professional SaaS application shell: collapsible responsive AppSidebar, sticky AppHeader, and authenticated user context
  - Reusable UI component library: Button, Card, Badge, Input, Modal, and EmptyState
  - Resource Catalog (`/resources`): responsive grid cards, category badges, location, and capacity indicators
  - Real-time toolbar: full-text search, category filter, status filter (Active/Inactive), and reset controls
  - Resource CRUD forms: Add/Edit modal dialogs with server-side Zod validation and error normalization
  - Soft deactivation & reactivation preserving reservation audit history
  - Dedicated Resource Details view (`/resources/[id]`) with live database specifications and statistics
- [x] **Stage 3.1 — CSS Stabilization, Design System Repair & UI Refinement** *(Completed)*
  - Diagnosed PostCSS pipeline mismatch with Webpack build under Tailwind CSS v4
  - Installed `@tailwindcss/postcss` and created `postcss.config.mjs`
  - Fully restored automated scanning and utility class generation (`.bg-blue-600`, `.flex`, `.rounded-xl`, etc.)
  - Aligned semantic palette to spec: `#F6F7FB` canvas, `#FFFFFF` surfaces, `#2563EB` primary, `#111827` text
  - Completed headless Chrome visual verification across desktop (1280x800) and mobile (375x812) viewports
- [x] **Stage 4 — Authentication, RBAC & Reservation Domain Preparation** *(Completed)*
  - Auth.js credential login, server-side role checks, approval-ready status migration, and pending/approved overlap protection
- [x] **Stage 4.1 — Public Member Sign-Up & Authentication UI** *(Completed)*
  - Member-only registration, shared rate limits, explicit demo credential management, and supplied logo integration
- [x] **Stage 5 — Booking Requests & Approval Workflow** *(Completed)*
  - Member requests, admin approval/rejection, cancellation, and conflict-friendly errors

---

## Authentication and local assessment

Auth.js Credentials handles login, logout, CSRF protection, and an encrypted HTTP-only session cookie (8-hour maximum age). Argon2id hashes are stored in `users.passwordHash`. Each protected server render or mutation reloads the current user from PostgreSQL, so role changes and deactivation take effect immediately. Set a strong `AUTH_SECRET` in the ignored `.env` file; use `openssl rand -base64 32` to generate it. Set `AUTH_URL` to the exact application origin (including port). HTTPS deployments use secure cookies.

Public registration is available at `/signup` and creates a MEMBER who can sign in immediately. Sign-up validates the name, email syntax and password on the server, requires at least 6 characters with a letter, number and special character (8+ recommended), hashes with Argon2id, and relies on database uniqueness for duplicate addresses. Email syntax does not prove mailbox ownership. No OTP or email provider configuration is required. Database-backed limits allow six sign-up submissions per address and 100 globally per hour, plus three per normalized email per day. Login permits eight attempts per normalized email, 30 per address, and 300 globally per 15 minutes. The address limit assumes a reverse proxy that overwrites forwarded address headers; email and global limits still apply independently. See the [authentication contract](docs/auth-api-contract.md) for exact actions, admin email edits, and legacy account behavior.

For local demo credentials, run `npm run db:setup-demo` after copying `.env.example` to `.env`. It fills only blank `AUTH_SECRET`, `SLOTIFY_DEMO_ADMIN_PASSWORD`, and `SLOTIFY_DEMO_MEMBER_PASSWORD` values, keeps existing values, sets `.env` permissions to `0600`, and does not print secrets. Then run `npm run db:seed` before opening public registration. The seed creates missing demo users and resources and provisions hashes only where absent; it **never rotates an existing password hash or changes an existing role**. It stops if the existing admin email belongs to a non-admin account. Demo emails are `adminslotify@gmail.com` (ADMIN) and `sarah.chen@primewave.local` (MEMBER); David and Emily use the member password as well. Read the passwords only from your local ignored `.env`, and never commit that file.

To intentionally reset an existing demo account, update its corresponding password variable in `.env`, then run `npm run db:reset-demo-password -- adminslotify@gmail.com` (or another documented demo email). This changes only that account's hash and does not print the password. For member accounts sharing the member variable, reset each account you intend to update. Existing sessions remain valid until their eight-hour expiry unless the user is deactivated.

| Operation | ADMIN | MEMBER |
|---|---:|---:|
| Browse resources and calendar | Yes | Yes |
| View reservations | All | Own |
| Create/edit/deactivate resources | Yes | No |
| View users and change roles | Yes | No |
| Approve/reject requests | Yes | No |
| Submit/cancel own requests | Yes, where authorized | Yes, for eligible own requests |

Reservation statuses are `PENDING`, `APPROVED`, `REJECTED`, and `CANCELLED`. Six preexisting `CONFIRMED` records were migrated to `APPROVED` on the local database. PostgreSQL enforces `[startTime, endTime)` overlap exclusion for `PENDING` and `APPROVED`, valid time order, status transitions, and last-active-admin protection. Resource and user deletion is restricted when reservation history exists; inactive resources reject new pending or approved reservations. Application instants are stored in UTC (`timestamptz`); business presentation uses `Asia/Colombo` (Sri Lanka).

Booking and approval actions use server-side identity checks and translate PostgreSQL overlap conflicts into a slot-conflict message.

## Sign-up and branding

The supplied `public/logo.png` is used in the sidebar and authentication pages. It is a wide wordmark, so the existing valid favicon remains in use. Admin account creation is not exposed publicly; only an authorized admin can promote a member from Administration. Run `npm run db:setup-demo`, `npx prisma migrate deploy`, and `npm run db:seed` for a fresh local setup.

With the app running locally, run `npm run test:auth` to execute the Stage 4.1 integration suite. Set `SLOTIFY_TEST_URL` to that server's origin when it is not `http://localhost:3000`, and make sure `AUTH_URL` matches the server origin. The suite creates and removes synthetic test users with generated credentials.

## Final database ERD

The final PostgreSQL design has **11 application tables and 18 foreign keys**. See the [complete SVG](docs/slotify-erd.svg), [PNG](docs/slotify-erd.png), [business overview](docs/slotify-erd-overview.svg), editable [DBML](docs/slotify-erd.dbml), and [database architecture notes](docs/database-architecture.md). The diagram is based on the final Prisma schema and all SQL migrations.

[Open the shareable dbdiagram.io ERD](https://dbdiagram.io/embed#c=pako%3AeJzFWN9v2zYQfs9fwbc2QOK26PawulvgOmri1XZSyQk2FIXASLRNRKJUkkriDf3fd5REi5JoWU3a9SVWpLsj777vfpAvXiAvSiRdblC63gga4AhdJkKuOPE%2BTpEI1iTGQ7QijHAsSYiWPInRJacixihOQhKhmEgcYokRZiHi5I6Se5DDK0yZkOjVa6QMxXQF%2BjRhYnDgsCxGV4JwN4kI%2BvcAodHpbDKH35kze%2Be4B18PChmXgNBdruZJLDORC18689PJ%2FEypXV66F9fOKTy6zp%2FOeJE%2FjkfzsTOdwrO2M1cOgmvK0GKTFmu6jue416PF5GLuu87HK8dblJaq97UFTPHtYubr9sIXS1iWeGu6lDOIVb7u7MKdF9t3rp3yaT45O1%2FA7%2Fur6dQ%2FHf2tvLjyFhezrSUnxjQar3EUEbYilxlPE6H9OJt4CzffgjI6G02m%2Fvh8ND9zlPYC30CQMwhkET0aoiyDP5%2FS2yPEEolYFkWf4QPDMUGSPEj0yXy9pFzIuf4GLyJc%2F5%2BonZWKGaNfMlK3yxXIW7RrtlMsxH3Cw3Ms1tocFaNA0juCbhKQx6yukS92TTjAScKRRJLGREgcp%2FKf568P6wIF3i75klFuFxZECBABcfWDKJNkRXh9xZCkmMuYMDnRkYPP5A169v4DkonxXQxoOEQXc3TqTJ2Fo6ixcCfjxTNlJuBEpU9rF%2FXFsjTcK6VixELyQAo8EXpublG59VXJzItNjsBJ%2BApWUQFOoYzA3Si5J%2Fx5HrBDRNgy4QHYDLAgx5C5hAma41DgWygzCNgwZ8AxzlE6xmFMGZKcrlTkUg6rBlIUCY1wABbF4FnFw9yYf2fg4wea1Hv4qShsQpB%2FyEUqMHKaN2AYj7zx6NTJUaAMfFIRfre5apjrNuI5CzSH5MytpGX22XOyBqjEfEWkY6SI%2BTWAmrDlfoPoDymwVuzhC5aSwAfhqrgyylZ2DoMhwsJxkjFpF1CIesCfPcsFUL6z2J5LP5LgBfRHOvBH1WJKEWoRYFcwqyKTr5T8UsMvFXwaPuQQglEDmg4rhtRW2cyv8bkz%2FmDB4eVg8GvZEKvY%2F%2FE7ejlEKlkpjmr5CL5C%2FsErHeKt06UHh7mxImXNnZvJleTdxheq3fQv9raarRp7q3k1yqIIOE1VBuvKDWhyOaMsk2RHKc2KEaCQEXah7vpf8udJ6fsjmap33yzDBU3MCAFBXv3y%2BrdhKyqv1IdfgCd6GAAK5S0MPuXvbfxBKeExBdQTFm3gD0FFfUY5GUySGP3qSRRRtavjs4Uf3cj%2BDFQ8W2skomqOKgZm5imnt72y3SqrJmlGHGdy7atl%2FIjmGKld3ZJNGb1m3HUt2V3Ku8t02%2F1Sp%2FB%2Buy14m2Tghg99mKwSTvc14D2E%2BLmIdyHaxHP3rGMHUEfqcQO0JS5lxDf7xhkLRF0zZpQUI5Vt0sApDqjcaFL91HSs3D%2B05acZd3382xN6Hai%2BAe0MY3PQ7G4tNdXve1j41i5XsyGpjGx0zHvQgiqqdgALI8teGVEcyduH9P%2BNSBXsR5VfR3rzh%2BbwWPvHkD5sH6HaXxt4lG8L%2Fzs6fR7Bt3o7Q3RGvQVy%2FhpPr04dVZMM1qoWA0Pn8jhJCWRi5Yz2JR8Py5sPBI%2F6ZmKoYVAWKi%2BQqmpc6oOZGCCPQCfiwZqqA1rGYRBIgkyJNiqdxtKvjPlBwjlo9cpDrd8jFbfJ3cXjVN0oJZk4%2FT6pxci93ZJtj33TtQiPLWH7HlJr9oBtwl7Fe%2BSSvf1vQTHPTiW5m7u3M7rcFBXgDLuJMLsdIpwCW8PjfObEWUglutmol1F5tlcHxjuIHjzuYplyRJ239p%2F%2FfwC3inW%2FF2yaqV6vCqulnR6VFkjbzygI9rFX%2Bv1EHmkjmkf1YNpZpL3OyxXsNp9HwGgkEMHBGmqgOrMoX4vCOazRqeBYslQjy606ZavtlxupTWzMuPDdS6uAphRI%2BlgOmPdLcOhK%2BBOOpjs43ovZNUNS3XK3rr3rV1M7BgQghMAr2xcqXILDp8yLIGS5PLJRrQbKUbl0u3i1BNsCRkTLdwZK24nTJcs3jXqPTt6elJDV5rpPIYmIwgRsQ38N5OdCW6OLQK3znnNQTphbQ3AOCXBImnZO9hpq32dubcKRrwx722jtomjQvFPZZcJ%2BGlHeVmO1cbLZFSZzBi%2BVK0obI9HeMJ80lZthbSha0K2pfxvILfXm0N7hv5nCjRDsGLsG9crwOBd32baOWD2X6LdCc%2Brqk0I9zLYHr0cG3ZxCeoZ611ZrppoDRh9jtd41aLanPjWjbsHsSR2pXQtP28qOoFR2%2FgNPolPt)

This is dbdiagram.io's stateless DBML-in-Link format: the schema is compressed into the URL fragment, so no account or editor permission is needed to view it. It is not a saved dbdiagram project, and the URL changes if the DBML changes. To make a saved editable copy, sign in at [dbdiagram.io](https://dbdiagram.io), create a new diagram, replace its sample DBML with the contents of `docs/slotify-erd.dbml`, confirm all 11 tables and 18 relationships render, then use **Share** to publish a read-only/public link and test it in a signed-out window. Replace the stateless link above with that saved diagram URL if required by the assessor.
