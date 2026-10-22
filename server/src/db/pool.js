import sql from "mssql";

/* ---------------------------------------------------------------
   Connection config comes from .env. Works with SQL Server
   Express / Developer / Standard, or Azure SQL (SQL authentication).
   --------------------------------------------------------------- */
export function buildConfig(database = process.env.DB_NAME || "MehndiStudio") {
    const cfg = {
        server: process.env.DB_SERVER || "localhost",
        database,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: {
            encrypt: String(process.env.DB_ENCRYPT || "false") === "true",
            trustServerCertificate: String(process.env.DB_TRUST_CERT || "true") === "true",
            enableArithAbort: true,
            // SQL Server 2008 R2 only speaks TLS 1.0, which modern Node blocks by default.
            // Keep true for 2008/2012/2014; set DB_LEGACY_TLS=false for SQL Server 2016+.
            ...(String(process.env.DB_LEGACY_TLS ?? "true") === "true"
                ? { cryptoCredentialsDetails: { minVersion: "TLSv1", ciphers: "DEFAULT@SECLEVEL=0" } }
                : {}),
        },
        pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
        requestTimeout: 30000,
        connectionTimeout: 15000,
    };
    // Named instance (e.g. localhost\SQLEXPRESS) → no port; otherwise use the port.
    if (process.env.DB_INSTANCE) cfg.options.instanceName = process.env.DB_INSTANCE;
    else cfg.port = Number(process.env.DB_PORT || 1433);
    return cfg;
}

let poolPromise = null;

export function getPool() {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(buildConfig())
            .connect()
            .catch((err) => { poolPromise = null; throw err; });
    }
    return poolPromise;
}

/* ---------------------------------------------------------------
   query("SELECT * FROM Users WHERE Id=@id", { id })
   - params: plain values (type inferred) OR { type, value } for explicit
   - `db` can be a Transaction (from withTransaction) or omitted
   --------------------------------------------------------------- */
function bind(request, params) {
    for (const [name, raw] of Object.entries(params || {})) {
        if (raw && typeof raw === "object" && !(raw instanceof Date) && "type" in raw && "value" in raw) {
            request.input(name, raw.type, raw.value);
        } else if (raw instanceof Date) {
            request.input(name, sql.DateTime2(3), raw);
        } else if (typeof raw === "boolean") {
            request.input(name, sql.Bit, raw);
        } else if (typeof raw === "number") {
            if (Number.isInteger(raw) && Math.abs(raw) < 2_000_000_000) request.input(name, sql.Int, raw);
            else request.input(name, sql.Decimal(14, 2), raw);
        } else if (raw === null || raw === undefined) {
            request.input(name, sql.NVarChar(sql.MAX), null);
        } else {
            request.input(name, sql.NVarChar(sql.MAX), String(raw));
        }
    }
    return request;
}

export async function query(text, params = {}, db = null) {
    const request = db ? new sql.Request(db) : (await getPool()).request();
    bind(request, params);
    const result = await request.query(text);
    return result.recordset || [];
}

/** Run several statements atomically. fn receives a transaction to pass as `db`. */
export async function withTransaction(fn) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const out = await fn(tx);
        await tx.commit();
        return out;
    } catch (err) {
        try { await tx.rollback(); } catch { /* already rolled back */ }
        throw err;
    }
}

export { sql };

/* Date helpers: DB gives Date objects → API returns ISO strings (as before) */
export const iso = (d) => (d ? new Date(d).toISOString() : null);
export const isoOrEmpty = (d) => (d ? new Date(d).toISOString() : "");
