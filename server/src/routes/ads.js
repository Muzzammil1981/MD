import express from "express";
import { adminOnly } from "../middleware/auth.js";
import {
    listAds, listAdsAdmin, getAd, createAd, updateAd, deleteAd,
    startRun, endRun, buildAdReport,
} from "../services/adService.js";
import { canAccessEvent } from "../services/eventService.js";

const router = express.Router();

/* An Admin may only manage ads that belong to one of THEIR events (SuperAdmin: all). */
async function requireAdAccess(req, res, next) {
    try {
        const ad = await getAd(req.params.id);
        if (!ad) return res.status(404).json({ message: "Ad not found" });
        if (!(await canAccessEvent(req.user, ad.eventId))) {
            return res.status(403).json({ message: "This ad belongs to another admin's event" });
        }
        next();
    } catch (err) { res.status(500).json({ message: err.message }); }
}

/* ---------- PUBLIC: active ads for a monitor ---------- */
router.get("/active", async (req, res) => {
    try {
        const { eventId } = req.query;
        if (!eventId) return res.status(400).json({ message: "eventId is required" });
        res.set("Cache-Control", "no-store"); // play counters must never come from a cache
        res.json(await listAds({ eventId }));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ---------- PUBLIC: run lifecycle (called by the monitor screen) ---------- */
router.post("/:id/run-start", async (req, res) => {
    try {
        const videoId = req.body?.videoId;
        if (!videoId) return res.status(400).json({ message: "videoId is required" });
        res.json(await startRun({ id: req.params.id, videoId }));
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.post("/:id/run-end", async (req, res) => {
    try {
        const runId = req.body?.runId;
        if (!runId) return res.status(400).json({ message: "runId is required" });
        res.json(await endRun({
            id: req.params.id,
            runId,
            completed: Boolean(req.body?.completed),
            // "error" = the video failed to load → must NOT count as a delivered play
            failed: req.body?.reason === "error",
        }));
    } catch (err) { res.status(400).json({ message: err.message }); }
});

/* ---------- ADMIN: CRUD ---------- */
router.get("/", ...adminOnly, async (req, res) => {
    try {
        const { eventId } = req.query;
        if (eventId && !(await canAccessEvent(req.user, eventId))) {
            return res.status(403).json({ message: "This event belongs to another admin" });
        }
        res.json(await listAdsAdmin({ eventId, ownerId: req.user.role === "SUPERADMIN" ? null : req.user.id }));
    }
    catch (err) { res.status(500).json({ message: err.message }); }
});

router.get("/:id", ...adminOnly, requireAdAccess, async (req, res) => {
    try {
        const ad = await getAd(req.params.id);
        if (!ad) return res.status(404).json({ message: "Ad not found" });
        res.json(ad);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", ...adminOnly, async (req, res) => {
    try {
        if (!(await canAccessEvent(req.user, req.body?.eventId))) {
            return res.status(403).json({ message: "You can only create ads for your own events" });
        }
        res.status(201).json(await createAd(req.body || {}));
    }
    catch (err) { res.status(400).json({ message: err.message }); }
});

router.patch("/:id", ...adminOnly, requireAdAccess, async (req, res) => {
    try { res.json(await updateAd({ id: req.params.id, patch: req.body || {} })); }
    catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete("/:id", ...adminOnly, requireAdAccess, async (req, res) => {
    try { res.json(await deleteAd(req.params.id)); }
    catch (err) { res.status(400).json({ message: err.message }); }
});

router.get("/:id/report", ...adminOnly, requireAdAccess, async (req, res) => {
    try {
        res.json(await buildAdReport({ id: req.params.id, from: req.query.from, to: req.query.to }));
    } catch (err) { res.status(400).json({ message: err.message }); }
});

export default router;
