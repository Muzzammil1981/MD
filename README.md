# Mehndi Studio - SQL Server edition

Same app, new storage:

| Before | Now |
|---|---|
| Google Drive `.json` / `.xlsx` files | **SQL Server tables** (20 tables (in schema `mehndi`), no JSON files) |
| Images in Google Drive | **Local folder `server/uploads/`** (only the file path is stored in the table) |
| One SuperAdmin from `.env` | **SuperAdmin → creates Admins → Users** (all in the `Users` table) |
| Socket.IO notifications | **Unchanged** (same events, same rooms; admins + superadmin both get admin alerts) |

```
mehndi-studio-sql/
├─ server/   Node.js + Express + mssql + Socket.IO
│  ├─ database/schema.sql      ← all tables (idempotent)
│  ├─ src/                     ← routes, services, db layer
│  └─ uploads/                 ← image files (designs/, custom/, settings/)
└─ client/   React + Vite (same UI, Drive card removed, "Admins" tab added)
```

## 1. Requirements
* Node.js 18+
* SQL Server 2016+ (Express / Developer / Standard) with **TCP/IP enabled** and **SQL Server authentication** (mixed mode) - a login such as `sa` or a dedicated user with `dbcreator`/`db_owner`.

## 2. Server setup
```bash
cd server
npm install
cp .env.example .env      # Windows: copy .env.example .env   → then edit .env
npm run dev               # or: npm start
```
On first start the server **creates the database, all tables, the 7 categories and the SuperAdmin** automatically (`npm run db:init` does only that). Alternatively run `database/schema.sql` yourself in SSMS after `CREATE DATABASE MaintenenceModule;`.

Important `.env` values: `DB_SERVER`, `DB_PORT` (or `DB_INSTANCE` for `localhost\SQLEXPRESS`), `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `CLIENT_URL`, `SUPERADMIN_USERNAME/PASSWORD`.
Health check: `http://localhost:5000/api/health` → `"database":"connected"`.

## 3. Client setup
```bash
cd client
npm install
cp .env.example .env      # VITE_API_URL=http://localhost:5000
npm run dev               # http://localhost:5173   admin portal: /admin
```

## 4. Roles
* **SUPERADMIN** - created from `.env` on first start. Everything an admin can do, plus the **Admins** tab: create admins, disable/enable, reset password, delete, change own password.
* **ADMIN** - created by the SuperAdmin. Designs, events, orders/payments, ads, reports, settings. A disabled/deleted admin is logged out immediately (token checked against the DB, live sockets dropped).
* **USER** - customers who register on the public site.

The admin portal (`/admin`) only accepts ADMIN/SUPERADMIN; the customer login only accepts USER.
After the first start the SuperAdmin password lives in the database (changing `.env` later has no effect) - change it from the Admins tab.

## 4b. Events belong to the admin who created them
* The **home page is always the normal catalogue** - it never switches to an event. A customer reaches an event only through that event's own link/QR: `/?event=<id>` (monitor screen: `/monitor?event=<id>`).
* Many admins can run events **at the same time** (e.g. UK and India). Each event has its own tokens, orders, ads and queue.
* Every **event** records its creator (`Events.OwnerId`) and every **design** records who uploaded it (`Designs.UploadedBy`; shown as "by …" in the admin).
* An **Admin** sees only their own events, plus the orders, ads, reports and customers of those events. The **SuperAdmin** sees everything. Socket alerts for an event go only to its owner + the SuperAdmin.
* An admin can delete only designs they uploaded (SuperAdmin: any). Deleting an admin moves their events and designs to the SuperAdmin - nothing is lost.
* **Payment settings are per admin** (UPI id, merchant name) and used for that admin's events. The SuperAdmin's settings are the studio's and apply to normal home-page bookings, which only the SuperAdmin handles. An admin with no UPI set does not fall back to someone else's - customers are asked to pay cash/card at the counter. (UPI works in India only; a UK admin should leave it blank.)

## 5. Where things are stored
| Data | Table(s) |
|---|---|
| Accounts | `Users` |
| Categories / designs / customer reference images | `Categories`, `Designs`, `CustomImages` |
| Events + included designs + event prices + token counter | `Events`, `EventDesigns`, `EventPriceOverrides` |
| Daily tokens (non-event) | `DailyTokens` |
| Orders, lines, group members, quote negotiation, edit history, refunds | `Orders`, `OrderItems`, `OrderMembers`, `OrderNegotiations`, `OrderModifications`, `OrderModificationItems`, `OrderRefunds` |
| UPI id / merchant / QR image path | `StudioSettings` (studio), `AdminSettings` (per admin) |
| Ads, videos, play log | `AdCampaigns`, `AdVideos`, `AdRuns` |

Images: `uploads/designs/<category>/<id>.webp` (+ `thumbs/`), `uploads/custom/…`, `uploads/settings/…`. Served at `http(s)://<api>/uploads/...`. **Back up `uploads/` together with the database.** Set `UPLOAD_DIR` in `.env` to keep them on another drive.

## 6. Changes beyond a straight port (deliberate)
* Design **upload/delete now require an admin** (before, anyone could call them).
* **Prices are re-read from the database** when an order is created/modified (before, the browser's price was trusted).
* **Token numbers are atomic** (a single SQL `UPDATE`), so two customers can never get the same token; group tokens are issued once and not regenerated on a re-claim.
* Editing a still-`pending` order no longer auto-approves it.
* Ad runs that report `reason: "error"` are no longer counted as plays (the old code ignored that flag).
* Event dates are stored as UTC; the create form now sends ISO dates like the edit form already did.
* Removed: Google Drive connection card and all `googleapis` / `xlsx` code.

## 7. Production notes
Run behind HTTPS (IIS/nginx/Caddy), set a long random `JWT_SECRET`, set `CLIENT_URL` to your real site, use a dedicated SQL login instead of `sa`, and schedule SQL Server backups.
