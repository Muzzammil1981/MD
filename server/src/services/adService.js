import crypto from "crypto";
import { query, withTransaction, iso } from "../db/pool.js";

/* =========================================================
   Row → API shape. "Derived" fields are computed, never stored.
   ========================================================= */
function toVideo(r) {
    const purchased = Number(r.PurchasedPlays) || 0;
    const completed = Number(r.PlaysCompleted) || 0;
    const interrupted = Number(r.PlaysInterrupted) || 0;
    const delivered = completed + interrupted;
    return {
        id: r.Id,
        url: r.Url,
        embedUrl: r.EmbedUrl,
        title: r.Title,
        durationSeconds: r.DurationSeconds,
        purchasedPlays: purchased,
        playsCompleted: completed,
        playsInterrupted: interrupted,
        deliveredPlays: delivered,
        remainingPlays: Math.max(0, purchased - delivered),
        exhausted: purchased > 0 && delivered >= purchased,
    };
}

function toCampaign(r, videoRows) {
    const videos = videoRows.map(toVideo);
    const purchased = videos.reduce((n, v) => n + (v.purchasedPlays || 0), 0);
    const delivered = videos.reduce((n, v) => n + v.deliveredPlays, 0);
    const cpp = Number(r.CostPerPlay) || 0;
    return {
        id: r.Id,
        eventId: r.EventId,
        advertiserName: r.AdvertiserName,
        advertiserContact: r.AdvertiserContact,
        campaignTitle: r.CampaignTitle,
        playMode: r.PlayMode,
        intervalMinutes: r.IntervalMinutes,
        costPerPlay: cpp,
        paid: r.Paid === true,
        active: r.Active === true,
        videos,
        lastPlayedAt: iso(r.LastPlayedAt),
        createdAt: iso(r.CreatedAt),
        updatedAt: iso(r.UpdatedAt),
        totalPurchasedPlays: purchased,
        totalDeliveredPlays: delivered,
        remainingPlays: Math.max(0, purchased - delivered),
        exhausted: purchased > 0 && delivered >= purchased,
        totalCost: cpp * purchased,
        earnedCost: cpp * delivered,
    };
}

async function fetchCampaigns(where, params, db = null) {
    const camps = await query(
        `SELECT c.* FROM mehndi.AdCampaigns c ${where} ORDER BY c.CreatedAt DESC`, params, db
    );
    if (!camps.length) return [];
    const vids = await query(
        `SELECT v.* FROM mehndi.AdVideos v
         WHERE v.CampaignId IN (SELECT c.Id FROM mehndi.AdCampaigns c ${where})
         ORDER BY v.CampaignId, v.SortOrder`,
        params, db
    );
    const byCamp = new Map();
    for (const v of vids) {
        if (!byCamp.has(v.CampaignId)) byCamp.set(v.CampaignId, []);
        byCamp.get(v.CampaignId).push(v);
    }
    return camps.map((c) => toCampaign(c, byCamp.get(c.Id) || []));
}

/* ---------- Public read (monitor): active, non-exhausted ads of an event ---------- */
export async function listAds({ eventId }) {
    const list = await fetchCampaigns(`WHERE c.EventId = @e AND c.Active = 1`, { e: eventId });
    return list.filter((c) => !c.exhausted);
}

/* ---------- Admin read ---------- */
export async function listAdsAdmin({ eventId, ownerId }) {
    const where = [];
    const params = {};
    if (eventId) { where.push("c.EventId = @e"); params.e = eventId; }
    if (ownerId) { where.push("c.EventId IN (SELECT Id FROM mehndi.Events WHERE OwnerId = @owner)"); params.owner = ownerId; }
    return fetchCampaigns(where.length ? `WHERE ${where.join(" AND ")}` : "", params);
}

export async function getAd(id) {
    return (await fetchCampaigns(`WHERE c.Id = @id`, { id }))[0] || null;
}

/* ---------- Create ---------- */
function validateVideos(videos) {
    return videos.map((v, i) => {
        if (!v.url?.trim()) throw new Error(`Video ${i + 1}: URL is missing`);
        if (!v.embedUrl?.trim()) throw new Error(`Video ${i + 1}: embed URL is missing`);
        if (!v.purchasedPlays || Number(v.purchasedPlays) < 1) {
            throw new Error(`Video ${i + 1}: purchased plays must be at least 1`);
        }
        if (!v.durationSeconds || Number(v.durationSeconds) < 5) {
            throw new Error(`Video ${i + 1}: duration must be at least 5 seconds`);
        }
        return {
            id: crypto.randomUUID(),
            url: String(v.url).trim(),
            embedUrl: String(v.embedUrl).trim(),
            title: String(v.title || `Video ${i + 1}`).trim(),
            durationSeconds: Number(v.durationSeconds),
            purchasedPlays: Number(v.purchasedPlays),
        };
    });
}

export async function createAd({
    eventId, advertiserName, advertiserContact, campaignTitle,
    playMode, intervalMinutes, costPerPlay, paid, videos,
}) {
    if (!eventId) throw new Error("Event is required");
    if (!advertiserName?.trim()) throw new Error("Advertiser name is required");
    if (!Array.isArray(videos) || videos.length === 0) throw new Error("At least one video is required");
    if (!["no-session", "interval", "no-session-and-interval"].includes(playMode)) {
        throw new Error("Invalid play mode");
    }
    if (playMode !== "no-session" && (!intervalMinutes || Number(intervalMinutes) < 1)) {
        throw new Error("Interval (minutes) is required for this play mode");
    }
    const ev = await query(`SELECT Id FROM mehndi.Events WHERE Id = @e`, { e: eventId });
    if (!ev[0]) throw new Error("Event not found");

    const norm = validateVideos(videos);
    const id = crypto.randomUUID();

    await withTransaction(async (tx) => {
        await query(
            `INSERT INTO mehndi.AdCampaigns
               (Id, EventId, AdvertiserName, AdvertiserContact, CampaignTitle, PlayMode, IntervalMinutes, CostPerPlay, Paid, Active)
             VALUES (@id, @e, @an, @ac, @ct, @pm, @im, @cpp, @paid, 1)`,
            {
                id, e: eventId,
                an: String(advertiserName).trim(),
                ac: String(advertiserContact || "").trim(),
                ct: String(campaignTitle || "").trim(),
                pm: playMode,
                im: playMode === "no-session" ? null : Number(intervalMinutes),
                cpp: Number(costPerPlay) || 0,
                paid: Boolean(paid),
            },
            tx
        );
        for (const [i, v] of norm.entries()) await insertVideo(id, v, i, 0, 0, tx);
    });
    return getAd(id);
}

function insertVideo(campaignId, v, sortOrder, completed, interrupted, tx) {
    return query(
        `INSERT INTO mehndi.AdVideos
           (Id, CampaignId, SortOrder, Url, EmbedUrl, Title, DurationSeconds, PurchasedPlays, PlaysCompleted, PlaysInterrupted)
         VALUES (@id, @c, @s, @u, @eu, @t, @d, @p, @pc, @pi)`,
        {
            id: v.id, c: campaignId, s: sortOrder, u: v.url, eu: v.embedUrl, t: v.title,
            d: v.durationSeconds, p: v.purchasedPlays, pc: completed, pi: interrupted,
        },
        tx
    );
}

/* ---------- Update ---------- */
export async function updateAd({ id, patch }) {
    const current = await getAd(id);
    if (!current) throw new Error("Ad not found");

    await withTransaction(async (tx) => {
        const next = {
            advertiserName: patch.advertiserName ?? current.advertiserName,
            advertiserContact: patch.advertiserContact ?? current.advertiserContact,
            campaignTitle: patch.campaignTitle ?? current.campaignTitle,
            playMode: patch.playMode ?? current.playMode,
            intervalMinutes: patch.intervalMinutes !== undefined ? patch.intervalMinutes : current.intervalMinutes,
            costPerPlay: patch.costPerPlay !== undefined ? Number(patch.costPerPlay) || 0 : current.costPerPlay,
            paid: patch.paid !== undefined ? Boolean(patch.paid) : current.paid,
            active: patch.active !== undefined ? Boolean(patch.active) : current.active,
        };
        if (!["no-session", "interval", "no-session-and-interval"].includes(next.playMode)) {
            throw new Error("Invalid play mode");
        }
        await query(
            `UPDATE mehndi.AdCampaigns
                SET AdvertiserName=@an, AdvertiserContact=@ac, CampaignTitle=@ct, PlayMode=@pm,
                    IntervalMinutes=@im, CostPerPlay=@cpp, Paid=@paid, Active=@act, UpdatedAt=SYSUTCDATETIME()
              WHERE Id=@id`,
            {
                id, an: String(next.advertiserName), ac: String(next.advertiserContact),
                ct: String(next.campaignTitle), pm: next.playMode,
                im: next.playMode === "no-session" || !next.intervalMinutes ? null : Number(next.intervalMinutes),
                cpp: next.costPerPlay, paid: next.paid, act: next.active,
            },
            tx
        );

        if (Array.isArray(patch.videos)) {
            const prev = new Map(current.videos.map((v) => [v.id, v]));
            const keepIds = [];
            for (const [i, v] of patch.videos.entries()) {
                const existing = v.id && prev.get(v.id);
                const row = {
                    id: existing ? v.id : crypto.randomUUID(),
                    url: String(v.url || "").trim(),
                    embedUrl: String(v.embedUrl || "").trim(),
                    title: String(v.title || `Video ${i + 1}`).trim(),
                    durationSeconds: Number(v.durationSeconds) || 30,
                    purchasedPlays: Number(v.purchasedPlays) || 1,
                };
                keepIds.push(row.id);
                if (existing) {
                    await query(
                        `UPDATE mehndi.AdVideos
                            SET SortOrder=@s, Url=@u, EmbedUrl=@eu, Title=@t, DurationSeconds=@d, PurchasedPlays=@p
                          WHERE Id=@id AND CampaignId=@c`,
                        { id: row.id, c: id, s: i, u: row.url, eu: row.embedUrl, t: row.title, d: row.durationSeconds, p: row.purchasedPlays },
                        tx
                    );
                } else {
                    await insertVideo(id, row, i, 0, 0, tx);
                }
            }
            // videos the admin removed from the form
            for (const old of current.videos) {
                if (!keepIds.includes(old.id)) {
                    await query(`DELETE FROM mehndi.AdVideos WHERE Id=@v AND CampaignId=@c`, { v: old.id, c: id }, tx);
                }
            }
        }
    });
    return getAd(id);
}

export async function deleteAd(id) {
    const rows = await query(`DELETE FROM mehndi.AdCampaigns OUTPUT DELETED.Id WHERE Id = @id`, { id });
    if (!rows[0]) throw new Error("Ad not found");
    return { ok: true };
}

/* =========================================================
   Run lifecycle (called by the monitor screen)
   ========================================================= */
export async function startRun({ id, videoId }) {
    const c = await getAd(id);
    if (!c) throw new Error("Ad not found");
    if (!c.active) throw new Error("Ad is paused");

    const v = c.videos.find((x) => x.id === videoId);
    if (!v) throw new Error("Video not found");
    if (v.exhausted) throw new Error("This video has reached its purchased plays");

    const runId = crypto.randomUUID();
    const startedAt = new Date();
    await withTransaction(async (tx) => {
        await query(
            `INSERT INTO mehndi.AdRuns (Id, CampaignId, VideoId, VideoTitle, StartedAt, PlannedDurationSeconds)
             VALUES (@id, @c, @v, @vt, @s, @pd)`,
            { id: runId, c: id, v: videoId, vt: v.title, s: startedAt, pd: v.durationSeconds },
            tx
        );
        await query(
            `UPDATE mehndi.AdCampaigns SET LastPlayedAt=@s, UpdatedAt=SYSUTCDATETIME() WHERE Id=@c`,
            { s: startedAt, c: id }, tx
        );
    });

    return {
        runId,
        campaignId: id,
        videoId,
        startedAt: startedAt.toISOString(),
        plannedDurationSeconds: v.durationSeconds,
    };
}

/* Count a finished run against its video (unless it was rejected) */
async function settleRun({ campaignId, videoId, completed, rejected }, tx) {
    if (rejected) return;
    await query(
        `UPDATE mehndi.AdVideos
            SET PlaysCompleted   = PlaysCompleted   + @dc,
                PlaysInterrupted = PlaysInterrupted + @di
          WHERE Id = @v AND CampaignId = @c`,
        { v: videoId, c: campaignId, dc: completed ? 1 : 0, di: completed ? 0 : 1 },
        tx
    );
}

/* Switch the campaign off once every purchased play has been delivered */
async function deactivateIfExhausted(campaignId, tx) {
    await query(
        `UPDATE mehndi.AdCampaigns SET Active = 0, UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @c AND Active = 1
            AND (SELECT SUM(PurchasedPlays) FROM mehndi.AdVideos WHERE CampaignId = @c) > 0
            AND (SELECT SUM(PlaysCompleted + PlaysInterrupted) FROM mehndi.AdVideos WHERE CampaignId = @c)
              >= (SELECT SUM(PurchasedPlays) FROM mehndi.AdVideos WHERE CampaignId = @c)`,
        { c: campaignId }, tx
    );
}

export async function endRun({ id, runId, completed, failed }) {
    return withTransaction(async (tx) => {
        const now = new Date();
        // Atomic claim: only the first end-call can close an open run (no double counting)
        const rows = await query(
            `UPDATE mehndi.AdRuns
                SET EndedAt = @now
             OUTPUT INSERTED.VideoId, INSERTED.StartedAt
             WHERE Id = @r AND CampaignId = @c AND EndedAt IS NULL`,
            { now, r: runId, c: id }, tx
        );

        if (!rows[0]) {
            const run = await query(`SELECT Id FROM mehndi.AdRuns WHERE Id=@r AND CampaignId=@c`, { r: runId, c: id }, tx);
            if (run[0]) return { ok: true, alreadyEnded: true };
            const camp = await query(`SELECT Id FROM mehndi.AdCampaigns WHERE Id=@c`, { c: id }, tx);
            throw new Error(camp[0] ? "Run not found" : "Ad not found");
        }

        const { VideoId, StartedAt } = rows[0];
        const duration = Math.max(0, Math.round((now - new Date(StartedAt)) / 1000));
        // Runs under 3 s (spam) or whose video failed to load never count as delivered plays
        const rejected = duration < 3 || Boolean(failed);

        await query(
            `UPDATE mehndi.AdRuns SET DurationSeconds=@d, Completed=@done, Rejected=@rej WHERE Id=@r`,
            { d: duration, done: Boolean(completed), rej: rejected, r: runId }, tx
        );
        await settleRun({ campaignId: id, videoId: VideoId, completed: Boolean(completed), rejected }, tx);
        await deactivateIfExhausted(id, tx);
        await query(`UPDATE mehndi.AdCampaigns SET UpdatedAt=SYSUTCDATETIME() WHERE Id=@c`, { c: id }, tx);
        return { ok: true };
    });
}

/* ---------- Sweeper (called every 60 s): close runs the monitor never ended ---------- */
export async function sweepStaleRuns() {
    const stale = await query(
        `SELECT Id, CampaignId FROM mehndi.AdRuns
          WHERE EndedAt IS NULL
            AND DATEDIFF(SECOND, StartedAt, SYSUTCDATETIME()) > PlannedDurationSeconds + 30`
    );
    let changed = false;

    for (const st of stale) {
        await withTransaction(async (tx) => {
            const now = new Date();
            const rows = await query(
                `UPDATE mehndi.AdRuns SET EndedAt = @now, Completed = 0
                 OUTPUT INSERTED.VideoId, INSERTED.StartedAt
                 WHERE Id = @r AND EndedAt IS NULL`,
                { now, r: st.Id }, tx
            );
            if (!rows[0]) return; // someone else closed it first
            const duration = Math.max(0, Math.round((now - new Date(rows[0].StartedAt)) / 1000));
            const rejected = duration < 3;
            await query(`UPDATE mehndi.AdRuns SET DurationSeconds=@d, Rejected=@rej WHERE Id=@r`,
                { d: duration, rej: rejected, r: st.Id }, tx);
            await settleRun({ campaignId: st.CampaignId, videoId: rows[0].VideoId, completed: false, rejected }, tx);
            await deactivateIfExhausted(st.CampaignId, tx);
            changed = true;
        });
    }
    return { changed };
}

/* ---------- Report ---------- */
export async function buildAdReport({ id, from, to }) {
    const campaign = await getAd(id);
    if (!campaign) throw new Error("Ad not found");

    const fromD = from ? new Date(from) : new Date(0);
    const toD = to ? new Date(new Date(to).getTime() + 24 * 3600 * 1000 - 1) : new Date("9999-12-31T00:00:00Z");

    const rows = await query(
        `SELECT * FROM mehndi.AdRuns
          WHERE CampaignId = @c AND StartedAt >= @f AND StartedAt <= @t
          ORDER BY StartedAt ASC`,
        { c: id, f: fromD, t: toD }
    );
    const runs = rows.map((r) => ({
        id: r.Id,
        videoId: r.VideoId,
        videoTitle: r.VideoTitle,
        startedAt: iso(r.StartedAt),
        endedAt: iso(r.EndedAt),
        durationSeconds: r.DurationSeconds,
        plannedDurationSeconds: r.PlannedDurationSeconds,
        completed: r.Completed === true,
        ...(r.Rejected === true ? { rejected: true } : {}),
    }));

    return {
        campaign,
        summary: {
            totalRuns: runs.length,
            completedRuns: runs.filter((r) => r.completed).length,
            interruptedRuns: runs.filter((r) => !r.completed && !r.rejected).length,
            rejectedRuns: runs.filter((r) => r.rejected).length,
            totalScreenTime: runs.reduce((n, r) => n + (r.durationSeconds || 0), 0),
        },
        runs,
    };
}
