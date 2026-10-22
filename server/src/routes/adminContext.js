import express from "express";
import { adminOnly } from "../middleware/auth.js";
import { listIndustries } from "../services/industryService.js";
import { listCategories } from "../services/categoryService.js";
import { getAdminIndustries } from "../services/adminAccess.js";
import { slugOf } from "../services/businessService.js";

const router = express.Router();

/* The industries the signed-in admin may work in, each with its categories.
   SuperAdmin → every industry. The dashboard uses it for the "Working in" switcher. */
router.get("/", ...adminOnly, async (req, res) => {
    try {
        const { active, industries } = await listIndustries();
        let allowed = industries;
        if (req.user.role === "ADMIN") {
            const mine = await getAdminIndustries(req.user.id);
            allowed = industries.filter((i) => mine.includes(i.key));
        }
        const out = [];
        for (const i of allowed) out.push({ key: i.key, name: i.name, slug: slugOf(i.key), isLive: i.key === active, categories: await listCategories(i.key) });
        res.json({ liveIndustry: active, industries: out });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
