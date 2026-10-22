import { query } from "../db/pool.js";

/* Both counters are incremented with a single atomic statement, so two
   customers can never receive the same token number - even under load. */

/** Reserve `n` consecutive tokens for an event. Returns e.g. [7, 8, 9]. */
export async function reserveEventTokens(eventId, n = 1, db = null) {
    const rows = await query(
        `UPDATE mehndi.Events
            SET TokenCounter = TokenCounter + @n
         OUTPUT INSERTED.TokenCounter AS Counter
         WHERE Id = @id`,
        { id: eventId, n },
        db
    );
    if (!rows[0]) throw new Error("Event not found");
    const last = rows[0].Counter;
    return Array.from({ length: n }, (_, i) => last - n + 1 + i);
}

export async function generateEventToken(eventId, db = null) {
    return (await reserveEventTokens(eventId, 1, db))[0];
}

function localDateKey(d = new Date()) {
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Reserve `n` consecutive daily (non-event) tokens; the counter resets every day. */
export async function reserveDailyTokens(n = 1, db = null) {
    const day = localDateKey();
    const rows = await query(
        `MERGE mehndi.DailyTokens WITH (HOLDLOCK) AS t
         USING (SELECT CAST(@d AS DATE) AS TokenDate) AS s ON t.TokenDate = s.TokenDate
         WHEN MATCHED THEN UPDATE SET Counter = t.Counter + @n
         WHEN NOT MATCHED THEN INSERT (TokenDate, Counter) VALUES (s.TokenDate, @n)
         OUTPUT INSERTED.Counter AS Counter;`,
        { d: day, n },
        db
    );
    const last = rows[0].Counter;

    return Array.from({ length: n }, (_, i) => last - n + 1 + i);
}

export async function nextDailyToken(db = null) {
    return (await reserveDailyTokens(1, db))[0];
}

/** Housekeeping: forget daily counters older than 30 days (called by the server on a timer). */
export async function purgeOldDailyTokens() {
    await query(`DELETE FROM mehndi.DailyTokens WHERE TokenDate < DATEADD(DAY, -30, CAST(SYSDATETIME() AS DATE))`);
}
