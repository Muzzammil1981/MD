import express from "express";
import { adminOnly } from "../middleware/auth.js";
import { buildReport } from "../services/reportService.js";
import { listCustomers } from "../services/userService.js";
import { listEvents, canAccessEvent } from "../services/eventService.js";

/* Admin → scoped to the events they own.  SuperAdmin → no restriction. */
const ownerScope = (user) => (user.role === "SUPERADMIN" ? null : user.id);

const router = express.Router();
router.use(...adminOnly);

/* GET /api/reports?from=...&to=...&userId=...&eventId=... */
router.get("/", async (req, res) => {
    try {
        const { from, to, userId, eventId } = req.query;
        if (eventId && !(await canAccessEvent(req.user, eventId))) {
            return res.status(403).json({ message: "This event belongs to another admin" });
        }
        res.json(await buildReport({ from, to, userId, eventId, ownerId: ownerScope(req.user) }));
    } catch (err) {
        console.error("reports failed:", err);
        res.status(500).json({ message: err.message });
    }
});

/* customers dropdown */
router.get("/customers", async (_req, res) => {
    try {
        const users = await listCustomers({ ownerId: ownerScope(req.user) });
        res.json(users.map((u) => ({ id: u.id, username: u.username, email: u.email })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* events dropdown */
router.get("/events", async (_req, res) => {
    try {
        const events = await listEvents(req.user);
        res.json(events.map((e) => ({ id: e.id, name: e.name })));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
