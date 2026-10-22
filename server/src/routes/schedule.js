import express from "express";
import { superAdminOnly } from "../middleware/auth.js";
import {
    getScheduleSettings, saveScheduleSettings, getSlots, planBooking, loadDurations,
} from "../services/scheduleService.js";

const router = express.Router();

/* PUBLIC - opening hours etc. (the booking form uses it for the date picker) */
router.get("/settings", async (_req, res) => {
    try { res.json(await getScheduleSettings()); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

/* SuperAdmin - change opening hours / stations / closed days */
router.put("/settings", ...superAdminOnly, async (req, res) => {
    try { res.json(await saveScheduleSettings(req.body || {})); }
    catch (err) { res.status(400).json({ message: err.message }); }
});

/* PUBLIC - POST /api/schedule/slots
   body: { date:"2026-10-20", items:[{id,qty}] }  or  { date, isGroup:true, members:[{items:[{id,qty}]}] }
   The server works out the duration from the catalogue, so the browser can't fake it. */
router.post("/slots", async (req, res) => {
    try {
        const body = req.body || {};
        const { date, isGroup = false } = body;
        const items = Array.isArray(body.items) ? body.items : [];
        const members = Array.isArray(body.members) ? body.members : [];
        const ids = isGroup ? members.flatMap((m) => (m.items || []).map((i) => i.id)) : items.map((i) => i.id);
        if (!ids.length) return res.status(400).json({ message: "Choose at least one service first" });

        const durations = await loadDurations(ids);
        const withDur = (list) => (list || []).map((i) => ({ qty: Math.max(1, Math.floor(Number(i.qty) || 1)), durationMinutes: durations.get(String(i.id)) || 60 }));
        const settings = await getScheduleSettings();
        const plan = planBooking(
            isGroup
                ? { isGroup: true, members: members.map((m) => ({ items: withDur(m.items) })) }
                : { isGroup: false, items: withDur(items) },
            settings.stations
        );
        res.json(await getSlots({ date, minutes: plan.minutes, stations: plan.stations }));
    } catch (err) { res.status(400).json({ message: err.message }); }
});

export default router;
