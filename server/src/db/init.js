/* Creates the database (if missing), runs schema.sql, seeds the SuperAdmin.
   Run manually:  npm run db:init      (the server also runs it on start) */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sql from "mssql";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { buildConfig, query, getPool } from "./pool.js";
import { getProfile } from "../config/industries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureDatabase() {
    const dbName = process.env.DB_NAME || "MehndiStudio";
    if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error("DB_NAME may only contain letters, numbers and _");

    const master = await new sql.ConnectionPool(buildConfig("master")).connect();
    try {
        await master.request().query(
            `IF DB_ID(N'${dbName}') IS NULL CREATE DATABASE [${dbName}];`
        );
    } finally {
        await master.close();
    }
}

async function runSchema() {
    const file = path.resolve(__dirname, "../../database/schema.sql");
    const script = fs.readFileSync(file, "utf8");
    const batches = script
        .split(/^\s*GO\s*$/gim)
        .map((b) => b.trim())
        .filter(Boolean);

    const pool = await getPool();
    for (const batch of batches) {
        await pool.request().batch(batch);
    }
}

async function seedSuperAdmin() {
    const username = (process.env.SUPERADMIN_USERNAME || "").trim();
    const password = process.env.SUPERADMIN_PASSWORD || "";
    if (!username || !password) {
        console.warn("⚠️  SUPERADMIN_USERNAME / SUPERADMIN_PASSWORD not set - no SuperAdmin seeded.");
        return;
    }

    const existing = await query(`SELECT TOP 1 Id FROM mehndi.Users WHERE Role = 'SUPERADMIN'`);
    if (existing.length) return; // already have one; password is managed in the DB from now on

    const hash = await bcrypt.hash(password, 10);
    await query(
        `INSERT INTO mehndi.Users (Id, Username, Email, FullName, PasswordHash, Role, Active)
         VALUES (@id, @username, @email, N'Super Admin', @hash, 'SUPERADMIN', 1)`,
        {
            id: crypto.randomUUID(),
            username,
            email: (process.env.SUPERADMIN_EMAIL || "").trim() || null,
            hash,
        }
    );
    console.log(`👑 SuperAdmin '${username}' created.`);
}

/* Starter categories (fresh database only) + adopt categories that predate "industries" */
async function seedCategories() {
    const profile = getProfile();
    const { industry, categories } = profile;

    // the industry that is active right now: chosen by the SuperAdmin, else INDUSTRY in .env
    const row = (await query(`SELECT ActiveIndustry FROM mehndi.AppSettings WHERE Id = 1`))[0];
    const activeKey = row?.ActiveIndustry || industry;

    // categories created before industries existed belong to the industry that is active now
    await query(`UPDATE mehndi.Categories SET IndustryKey = @k WHERE IndustryKey IS NULL`, { k: activeKey });

    // orders / events created before industries existed, and admins with no industry yet, belong to the live industry
    await query(`UPDATE mehndi.Orders SET IndustryKey = @k WHERE IndustryKey IS NULL`, { k: activeKey });
    await query(`UPDATE mehndi.Events SET IndustryKey = @k WHERE IndustryKey IS NULL`, { k: activeKey });
    await query(
        `INSERT INTO mehndi.AdminIndustries (AdminId, IndustryKey)
         SELECT u.Id, @k FROM mehndi.Users u
         WHERE u.Role = 'ADMIN' AND NOT EXISTS (SELECT 1 FROM mehndi.AdminIndustries ai WHERE ai.AdminId = u.Id)`, { k: activeKey });

    const existing = (await query(`SELECT COUNT(*) AS N FROM mehndi.Categories`))[0].N;
    if (existing === 0) {
        for (const [i, c] of categories.entries()) {
            await query(
                `INSERT INTO mehndi.Categories (Id, Name, ShortName, FolderName, Description, Accent, SortOrder, IndustryKey)
                 VALUES (@id, @name, @short, @folder, @desc, @accent, @sort, @k)`,
                { id: c.id, name: c.name, short: c.shortName, folder: c.shortName, desc: c.description, accent: c.accent, sort: i + 1, k: industry });
        }
    }
    // a brand-new studio still has the factory merchant name - make it the shop's own name
    await query(
        `UPDATE mehndi.StudioSettings SET MerchantName = @n WHERE Id = 1 AND MerchantName = N'Mehndi Studio' AND UpiId = N'' AND @n <> N'Mehndi Studio'`,
        { n: profile.name });
    console.log(`🏷️  Industry profile: ${industry}`);
}

export async function initDatabase() {
    await ensureDatabase();
    await runSchema();
    await seedCategories();
    await seedSuperAdmin();
    console.log("🗄️  Database ready.");
}

// Allow `node src/db/init.js`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    initDatabase()
        .then(() => process.exit(0))
        .catch((err) => { console.error("❌ DB init failed:", err.message); process.exit(1); });
}
