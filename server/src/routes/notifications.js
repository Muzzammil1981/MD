import express from "express";
import { adminOnly } from "../middleware/auth.js";
import { notifyUsers } from "../socket.js";
import { getProfile, cap } from "../config/industries.js";

const router = express.Router();

router.post("/broadcast", ...adminOnly, (req, res) => {
    const { title, body, designId } = req.body || {};
    const payload = {
        id: Date.now().toString(),
        title: title || `New ${cap(getProfile().item)}`,
        body: body || `A new ${getProfile().item} has been added.`,
        designId,
        at: new Date().toISOString(),
    };
    notifyUsers(payload);
    res.json({ ok: true, payload });
});

export default router;
