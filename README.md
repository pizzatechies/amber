# Amber

An online course marketplace. Instructors publish courses made of videos, articles, documents and quizzes; students buy or
enroll, learn in a course player, and earn certificates; administrators review courses and run the platform.

## What's included

**For learners**
- Catalogue with search, filters (category, level, price, rating) and sorting
- Course pages with a curriculum outline, free preview lectures, reviews and instructor profile
- Cart, coupon codes, checkout, purchase history and a wishlist
- Course player: video (resume where you left off, playback speed, auto-advance), articles, PDF/documents, quizzes
- Progress tracking, private timestamped notes, Q&A, reviews and completion certificates with a public verification link

**For instructors**
- A studio to build courses: details, learning goals, sections and lectures, downloadable resources
- Resumable uploads for large videos, or link a YouTube/Vimeo video instead
- Pricing, per-course coupon codes with shareable links, announcements to enrolled students
- Students and their progress, a Q&A inbox, review replies and an earnings report

**For administrators**
- Review queue to approve courses or send them back with a note
- User roles and suspension, category management, orders and refunds, platform settings

## Quick start

You need Node.js 22+ and PostgreSQL 16+ (or Docker).

```bash
cp .env.example .env
```

```bash
docker compose up -d db
```

```bash
npm install
```

```bash
npm run db:deploy
```

```bash
npm run db:seed:demo
```

```bash
npm run dev
```

Open http://localhost:3000. The demo seed creates sample courses and these accounts (password for all: `amber-demo-1234`):

| Role | Email |
| --- | --- |
| Admin | `admin@amber.test` |
| Instructor | `ada@amber.test` |
| Student | `maya@amber.test` |

Skip `db:seed:demo` and run `npm run db:seed` instead for an empty site with just the categories. To run everything in
Docker, use `docker compose up --build`.

## Configuration

All settings are environment variables; `.env.example` documents each one.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. The only required setting. |
| `APP_URL` | Public address of the site. Used in emails and payment redirects. Use `https://` in production: it also makes the session cookie `Secure`. |
| `NEXT_PUBLIC_SITE_NAME`, `NEXT_PUBLIC_CURRENCY` | Brand name and ISO currency code. Read at **build** time, so rebuild after changing them. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Creates the first admin account when the seed runs. |
| `STORAGE_DRIVER` | `local` (files under `UPLOAD_DIR`) or `s3` (any S3-compatible bucket, see the `S3_*` variables). |
| `MAX_VIDEO_MB`, `MAX_FILE_MB`, `MAX_IMAGE_MB` | Upload size limits. |
| `PAYMENT_PROVIDER` | `sandbox` or `stripe`. |
| `SMTP_URL`, `MAIL_FROM` | Outgoing email. Without `SMTP_URL`, emails are printed to the server log. |

Two platform rules are changed in the admin console instead (Admin → Settings): whether courses need approval before
going live, and the instructor's share of each sale.

### Payments

`PAYMENT_PROVIDER=sandbox` is the default. It replaces the payment page with a clearly labelled test screen where you
choose whether the payment succeeds. **It never charges anyone**, so switch providers before selling.

For Stripe, set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, and add a webhook endpoint in
Stripe pointing at `/api/webhooks/stripe` for the `checkout.session.*` events. The Stripe integration has not been run
against Stripe itself yet: do a full purchase and refund with test keys before going live.

To add another gateway, implement the `PaymentProvider` interface in `src/lib/payments/types.ts` and register it in
`src/lib/payments/index.ts`.

Instructor payouts are not automated. The earnings report shows what each instructor is owed; paying them is up to you.

### File storage

Uploads go through the app in 8 MB chunks, so large videos survive dropped connections and proxy body limits.

- **local**: files live in `UPLOAD_DIR`. In production this must be a persistent disk or volume, or uploads disappear on
  every deploy.
- **s3**: the bucket stays private. Videos are played through short-lived signed URLs.

Videos are served as uploaded (no transcoding). MP4 with H.264 video and AAC audio plays in every browser.

## Deploying

The app is a single Node.js service plus PostgreSQL.

- **Docker**: the `Dockerfile` builds a production image. On start it applies database migrations, runs the base seed and
  serves on `$PORT`. Mount a volume at `/data` for uploads (or use S3).
- **Render**: `render.yaml` is a blueprint for the web service, a disk and a database.
- **Anywhere else**: `npm ci && npm run build`, then `npm run start:prod`.

The build does not need database access. Run one instance unless you move rate limiting to a shared store
(`src/lib/auth/rate-limit.ts` keeps its counters in memory).

`GET /api/health` returns 200 when the app can reach the database.

## Development

```bash
npm run dev          # start the dev server
npm run lint         # ESLint
npm run typecheck    # generate route types, then tsc
npm test             # unit tests (Vitest)
npm run test:e2e     # end-to-end tests (Playwright; needs the demo seed)
npm run db:migrate   # create and apply a migration after editing prisma/schema.prisma
```

### Layout

```
prisma/              schema, migrations and seed
src/app/             routes: (site) public and learner pages, learn/ player, instructor/ studio, admin/, api/
src/components/      UI, grouped by area
src/lib/             domain logic: auth, courses, commerce, payments, storage, mail
src/server/actions/  Server Actions (all mutations)
tests/, e2e/         unit and end-to-end tests
```

### Things worth knowing

- Built on Next.js 16 with Cache Components. Pages are a static shell with the data streamed in, so anything that reads
  the request or the database sits inside a `<Suspense>` boundary. Read `AGENTS.md` before changing framework-level code.
- Next.js keeps recently visited pages mounted but hidden. Forms therefore avoid element ids, and tests use role-based
  or visibility-filtered selectors.
- Every Server Action and Route Handler checks the session and ownership itself; `src/proxy.ts` only provides an early
  redirect for signed-out visitors.
- A lecture is shown to students only once it has content (`Lecture.isReady`), so instructors can add to a live course
  safely.

## License

No license has been chosen yet. The bundled fonts (Figtree, Fraunces) are under the SIL Open Font License; see
`src/fonts/README.md`.
