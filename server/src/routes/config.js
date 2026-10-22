import express from "express";
import { getProfile } from "../config/industries.js";
import { listCategories } from "../services/categoryService.js";
import { slugOf } from "../services/businessService.js";

const router = express.Router();

/* PUBLIC - the client reads this once at start-up to label the whole app
   (shop name, "service" vs "design", hero text, categories ...). */
router.get("/", async (_req, res) => {
    try {
        const { categories: _seed, ...profile } = getProfile();   // the DB is the source of truth for categories
        res.set("Cache-Control", "no-store");
        res.json({ ...profile, slug: slugOf(profile.industry), categories: await listCategories() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
