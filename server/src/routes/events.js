import express from "express";
import { adminOnly } from "../middleware/auth.js";
import { getProfile } from "../config/industries.js";
import { canAccessIndustry } from "../services/adminAccess.js";
import {
    listEvents, getEvent, canAccessEvent, createEvent, updateEvent, deleteEvent, buildEventQueue,
} from "../services/eventService.js";

const router = express.Router();

/* Event data is live (tokens, dates) - never let the browser cache it */
router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
});

const fail = (res, err, fallback) =>
    res.status(err.status || 500).json({ message: err.message || fallback });

/* NOTE: there is intentionally no "active event" lookup. The home page never turns into
   an event page - a customer reaches an event only through its own link / QR code. */

/* 403 unless the signed-in admin owns this event (SuperAdmin passes always) */
async function requireEventAccess(req, res, next) {
    try {
        if (!(await getEvent(req.params.id))) return res.status(404).json({ message: "Event not found" });
        if (!(await canAccessEvent(req.user, req.params.id))) {
            return res.status(403).json({ message: "This event belongs to another admin" });
        }
        next();
    } catch (err) { fail(res, err, "Failed"); }
}

/* GET /api/events - an admin sees only their own events; the SuperAdmin sees all */
router.get("/", ...adminOnly, async (req, res) => {
    try { res.json(await listEvents(req.user)); }
    catch (err) { fail(res, err, "Failed to load events"); }
});

/* GET /api/events/:id/queue - public, for the monitor screen */
router.get("/:id/queue", async (req, res) => {
    try {
        const queue = await buildEventQueue(req.params.id);
        if (!queue) return res.status(404).json({ message: "Event not found" });
        res.json(queue);
    } catch (err) { fail(res, err, "Failed to load queue"); }
});

/* GET /api/events/:id - public (QR scans), any event regardless of dates */
router.get("/:id", async (req, res) => {
    try {
        const event = await getEvent(req.params.id);
        if (!event) return res.status(404).json({ message: "Event not found" });
        const { ownerId, ownerName, ...publicEvent } = event;   // customers don't need to see the owner
        res.json({ active: true, event: publicEvent, currentToken: event.tokenCounter || 0 });
    } catch (err) { fail(res, err, "Failed to load event"); }
});

router.post("/", ...adminOnly, async (req, res) => {
    try {
        const live = getProfile().industry;
        if (!(await canAccessIndustry(req.user, live))) {
            return res.status(403).json({ message: "You are not assigned to the industry that is live right now" });
        }
        res.status(201).json(await createEvent(req.body || {}, req.user.id));
    }
    catch (err) { fail(res, err, "Failed to create event"); }
});

router.patch("/:id", ...adminOnly, requireEventAccess, async (req, res) => {
    try { res.json(await updateEvent(req.params.id, req.body || {})); }
    catch (err) { fail(res, err, "Failed to update event"); }
});

router.delete("/:id", ...adminOnly, requireEventAccess, async (req, res) => {
    try {
        const ok = await deleteEvent(req.params.id);
        if (!ok) return res.status(404).json({ message: "Event not found" });
        res.json({ message: "Event deleted" });
    } catch (err) { fail(res, err, "Failed to delete event"); }
});

export default router;
