# DAKSH ONLINE PRINTING — Backend (Part C)

NestJS 10 + TypeScript + PostgreSQL (TypeORM). This is the API the
Flutter customer app (Part A) and the Admin Dashboard (Part B) talk to.
All routes are under `/api/v1`. All money is **integer paise**
(₹99 = 9900) everywhere — database, API, Razorpay.

## What is implemented

- **Customer auth** — mobile OTP login (hashed, 5-min expiry, attempt
  limits, resend cooldown) → JWT; `GET/PATCH /me`.
- **Addresses** — owner-scoped CRUD with default-address handling.
- **Catalogue** — `GET /products`, `GET /products/:slug` (active
  products with price options, straight from the database).
- **Uploads** — presigned PUT URLs to private S3-compatible storage
  (JPG/PNG/PDF, ≤ 25 MB), then confirm → `uploaded_files` row with a
  retention date.
- **Quotes** — prices always recomputed from the database; coupon
  validation (percent/flat, min order, validity window, max discount).
- **Payments (Razorpay)** — backend creates the order + Razorpay order;
  payment is confirmed ONLY after HMAC-SHA256 signature verification
  (`/payments/verify`) or the signature-checked Razorpay webhook.
  The app is never trusted for payment success.
- **Orders** — 7-step status flow + cancellation (customer: only before
  printing starts), full status history, shipment info.
- **Admin** — email/password login (bcrypt), dashboard stats, order
  search/filter/detail (with time-limited signed file-download URLs),
  status updates with flow validation, internal notes, product/price
  management, customer list + history, sales reports (daily / monthly /
  product-wise / delivery / payments / labelled profit **estimate**),
  support tickets + replies. Admin actions are written to `audit_logs`.
- **Notifications** — every notification is stored in the database;
  an FCM push is sent only when Firebase is configured and the customer
  has a device token.
- **Shiprocket (Phase 6)** — real API flow (login → create order →
  AWB → pickup) + tracking webhook, gated on credentials (see below).
- **Security** — global rate limiting (stricter on OTP/admin login),
  DTO validation on every endpoint, JWT type separation (customer vs
  admin tokens), private storage with signed URLs, no secrets in code.

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Create the PostgreSQL database

```sql
CREATE DATABASE daksh_printing;
```

(PostgreSQL 13+ recommended. The schema uses `pgcrypto` for UUIDs —
the migration enables it automatically.)

### 3. Configure `.env`

```bash
cp .env.example .env
```

Values **you** must supply (never commit the real `.env`):

| Key | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `JWT_SECRET` | Invent a long random string (e.g. `openssl rand -hex 32`) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay Dashboard → Settings → API Keys (needs a Razorpay business account: PAN + bank details) |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay Dashboard → Settings → Webhooks — create a webhook pointing at `https://<your-domain>/api/v1/webhooks/razorpay` for `payment.captured` + `payment.failed`, and paste its secret here |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | Shiprocket panel → Settings → API → create an API user |
| `SHIPROCKET_WEBHOOK_TOKEN` | Shiprocket panel → Settings → API/Webhooks — set the webhook URL to `https://<your-domain>/api/v1/webhooks/shiprocket` and copy the token |
| `SHIPROCKET_PICKUP_POSTCODE` | Your shop/home PIN code (needed for rate checks) |
| `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`, `STORAGE_ENDPOINT` | Your S3-compatible storage (AWS S3, Cloudflare R2, etc.). Create a **private** bucket. `STORAGE_ENDPOINT` is only needed for non-AWS providers |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Project settings → Service accounts → Generate new private key. Paste the JSON contents (or a path to the JSON file on the server) |
| `OTP_DEV_MODE` | `true` only for local development (OTPs are printed in the server log). See "OTP SMS" below |

Optional integrations fail safe: without Razorpay keys, payment
endpoints return a clear "not configured" error; without storage keys,
upload endpoints do the same; without Shiprocket keys, shipping does
the same. Nothing is faked.

### 4. Run migrations

```bash
npm run migration:run
```

Creates all 15 tables from `docs/DATABASE_SCHEMA.md`, plus an
`otp_codes` table (OTP storage — no schema table existed for it) and
the `order_no_seq` sequence (order numbers `DAKSH-1001`, `DAKSH-1002`, …).

### 5. Seed the catalogue

```bash
npm run seed
```

Inserts the 6 services with the approved design prices (PVC Photo ID
Card ₹99 + ₹49 delivery, Passport Photo, Photo Printing, Document
Printing, PDF Printing, Bulk Printing) and the `WELCOME10` coupon
(10% off). These are starting prices — change them later from the
Admin Dashboard, not by editing the seed.

### 6. Create the admin (owner) account

```bash
npm run create-admin -- --email you@example.com --password 'a-strong-password' --name 'Owner'
```

…or set `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` in `.env`, or
run it bare and answer the prompts. Passwords are stored only as
bcrypt hashes. There is **no default admin password** anywhere in the
code — if you skip this step, nobody can log in to the admin panel.

### 7. Run

```bash
npm run start:dev     # development (watch mode)
npm run build && npm run start:prod   # production
```

The API listens on `API_PORT` (default 3000) under `/api/v1`, e.g.
`http://localhost:3000/api/v1/products`. Point the Flutter app at it
via `AppConfig.apiBaseUrl` in `customer-app/lib/config.dart`.

## OTP SMS — important

Login OTPs must be delivered by a real SMS provider in production.
Right now:

- `OTP_DEV_MODE=true` → OTPs are printed in the server console
  (development only — anyone with log access could read login codes).
- Dev mode off and no provider → `/auth/send-otp` returns a clear
  "OTP service is not configured" error. It never pretends to send.

To go live: create an account with an SMS provider (MSG91, Twilio,
Fast2SMS…), put its API key in `.env`, and implement the send call in
`ProductionSmsProvider` in `src/modules/auth/sms.provider.ts` (marked
with a TODO). No SMS credentials exist in this codebase because none
were provided.

## Payments — how confirmation works

1. App → `POST /payments/create-order` → backend prices the cart from
   the DB, creates the order as `pending_payment`, creates a Razorpay
   order, stores a `payments` row (`created`), returns
   `razorpay_order_id` + `key_id` (the key id is public; the secret
   never leaves the server).
2. App opens Razorpay checkout with those values.
3. App → `POST /payments/verify` with Razorpay's ids + signature →
   backend verifies `HMAC-SHA256(order_id|payment_id, KEY_SECRET)`.
   Only a valid signature marks the payment `captured` and the order
   `received`.
4. Razorpay's webhook (`payment.captured` / `payment.failed`,
   signature-checked against `RAZORPAY_WEBHOOK_SECRET`) does the same
   idempotently, covering the case where the app closes mid-payment.
   Unpaid drafts stay invisible to the customer and admin lists.

## Shiprocket (Phase 6)

`POST /admin/orders/:id/ship` creates the shipment, generates the AWB
and requests pickup; courier updates arrive at
`POST /webhooks/shiprocket` and advance the order status automatically.
Until `SHIPROCKET_EMAIL`/`SHIPROCKET_PASSWORD` are set, shipping
endpoints return a clear "Shiprocket is not configured" error — AWB
numbers are never invented. `POST /shipping/quote` checks PIN
serviceability/rates once configured.

## File retention

Each confirmed upload gets `retention_delete_at = upload time +
FILE_RETENTION_DAYS` (default 30). Deleting the actual objects from
storage on that date should be done with a bucket lifecycle rule or a
scheduled job on the server (not included — set a lifecycle rule on
the bucket prefix `uploads/` matching your retention policy).

## Project layout

```
src/
├── main.ts               # bootstrap: /api/v1 prefix, validation, raw body for webhooks
├── app.module.ts         # config, throttler, JWT, TypeORM, feature modules
├── config/               # .env → typed configuration
├── common/               # order-status flow, JWT guards, serializers (app contract)
├── entities/             # 15 schema tables + otp_codes
├── database/             # data-source (CLI/scripts) + migrations
├── modules/
│   ├── auth/             # OTP + SMS provider interface
│   ├── users/            # /me profile
│   ├── addresses/        # delivery addresses
│   ├── products/         # catalogue (+ admin CRUD via admin module)
│   ├── storage/          # S3 presigned URLs
│   ├── uploads/          # presign / confirm
│   ├── orders/           # quote, orders, cancel, pricing
│   ├── payments/         # Razorpay create/verify + webhooks
│   ├── shipping/         # Shiprocket
│   ├── notifications/    # DB notifications + FCM sender
│   ├── support/          # customer support tickets
│   ├── audit/            # audit_logs writer
│   └── admin/            # admin auth, dashboard, orders, reports…
├── seed.ts               # npm run seed
└── scripts/create-admin.ts
```

## Known notes / contract decisions

- **App wins over docs** where they differed: uploads store full MIME
  types (`image/jpeg`, …) as the app sends them, not the schema doc's
  `jpg/png/pdf` shorthand; quote accepts `coupon` and order drafts
  accept `coupon_code` (the app uses both).
- Order numbers use the `DAKSH-1001+` sequence (Phase 3 instruction);
  the schema doc's `DAKSH-2026-0001` example was not used.
- `users.fcm_token` was added (not in the schema doc) — push
  notifications are impossible without a device token. The app sets it
  via `PATCH /me` (`fcm_token`).
- Delivery charge is the sum of the per-line delivery charges from
  `product_prices` until Phase 6 replaces it with live Shiprocket
  rating (noted in `pricing.service.ts`).
