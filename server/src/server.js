import "dotenv/config";

import express from "express";
import cors from "cors";
import http from "http";

import { initDatabase } from "./db/init.js";
import { getPool } from "./db/pool.js";
import { UPLOAD_DIR } from "./utils/files.js";
import { initSocket } from "./socket.js";

import { listCategories } from "./services/categoryService.js";
import { sweepStaleRuns } from "./services/adService.js";
import { purgeOldDailyTokens } from "./services/tokenService.js";

import authRoutes from "./routes/auth.js";
import adminsRoutes from "./routes/admins.js";
import usersRoutes from "./routes/users.js";
import designsRoutes from "./routes/designs.js";
import ordersRoutes from "./routes/orders.js";
import eventRoutes from "./routes/events.js";
import adsRoutes from "./routes/ads.js";
import settingsRoutes from "./routes/settings.js";
import reportsRoutes from "./routes/reports.js";
import notificationRoutes from "./routes/notifications.js";
import reviewsRoutes from "./routes/reviews.js";
import scheduleRoutes from "./routes/schedule.js";
import configRoutes from "./routes/config.js";
import businessRoutes from "./routes/business.js";
import adminContextRoutes from "./routes/adminContext.js";
import { refreshProfiles, getDefaultKey } from "./services/industryService.js";
import { ensureIndustryRows } from "./services/businessService.js";
import { industryMiddleware } from "./middleware/industry.js";
import businessesRoutes from "./routes/businesses.js";

for (const key of ["JWT_SECRET", "CLIENT_URL", "DB_USER", "DB_PASSWORD"]) {
    if (!process.env[key]) {
        console.error(`❌ Missing ${key} in .env - copy .env.example to .env and fill it in.`);
        process.exit(1);
    }
}

const app = express();
const server = http.createServer(app);

app.set("trust proxy", 1);
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));

/* Uploaded images (designs, custom references, QR) are served straight from disk.
   File names are unique (timestamped), so they can be cached "forever". */
app.use(
    "/uploads",
    express.static(UPLOAD_DIR, {
        maxAge: "365d",
        immutable: true,
        fallthrough: true,
        setHeaders: (res) => res.set("Cross-Origin-Resource-Policy", "cross-origin"),
    })
);

app.get("/api/health", async (_req, res) => {
    try {
        await (await getPool()).request().query("SELECT 1 AS ok");
        res.json({ ok: true, service: "mehndi-studio-api", database: "connected" });
    } catch (err) {
        res.status(503).json({ ok: false, service: "mehndi-studio-api", database: "down", message: err.message });
    }
});

app.get("/api/categories", async (_req, res) => {
    try { res.json(await listCategories()); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

/* which business is each request for?  (X-Industry header → AsyncLocalStorage) */
app.use("/api", industryMiddleware);

app.use("/api/businesses", businessesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admins", adminsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/designs", designsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/ads", adsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/config", configRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/admin-context", adminContextRoutes);

/* Last-resort error handler (keeps the API returning JSON) */
app.use((err, _req, res, _next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: err.message || "Server error" });
});

initSocket(server);

async function start() {
    try {
        await initDatabase(); // creates DB + tables on first run, seeds the SuperAdmin
        await ensureIndustryRows(await getDefaultKey());   // every business has an address + its own opening hours
        await refreshProfiles();                           // wording of every business
    } catch (err) {
        console.error("❌ Could not set up SQL Server:", err.message);
        console.error("   Check DB_SERVER / DB_USER / DB_PASSWORD in .env and that SQL Server accepts TCP/IP + SQL logins.");
        process.exit(1);
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🌸 Mehndi Studio API → http://localhost:${PORT}`));

    // Close ad runs the monitor never reported as finished
    setInterval(() => {
        sweepStaleRuns().catch((err) => console.error("[ads sweeper]", err?.message));
    }, 60 * 1000);

    // Housekeeping once a day
    purgeOldDailyTokens().catch(() => { });
    setInterval(() => purgeOldDailyTokens().catch(() => { }), 24 * 60 * 60 * 1000);
}

start();
