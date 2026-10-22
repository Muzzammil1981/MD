import express from "express";
import { listPublishedBusinesses } from "../services/businessService.js";

const router = express.Router();

/* PUBLIC - the directory on the main address: every published business */
router.get("/", async (_req, res) => {
    try {
        res.set("Cache-Control", "no-store");
        res.json(await listPublishedBusinesses());
    } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;
