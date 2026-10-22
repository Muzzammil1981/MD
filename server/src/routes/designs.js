import express from "express";
import multer from "multer";
import { adminOnly } from "../middleware/auth.js";
import { notifyUsers } from "../socket.js";
import {
    listAllDesigns, listDesignsPaged, designSummary, getDesign,
    createDesign, deleteDesign, createCustomImage,
} from "../services/designService.js";
import { getProfile } from "../config/industries.js";
import { currentIndustry } from "../middleware/industry.js";
import { canAccessIndustry } from "../services/adminAccess.js";
import { getCategoryAny } from "../services/categoryService.js";

const router = express.Router();

/* ---------- upload middleware ---------- */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        cb(null, ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.mimetype));
    },
});

function uploadImage(req, res, next) {
    upload.single("image")(req, res, (err) => {
        if (!err) return next();
        const message = err.code === "LIMIT_FILE_SIZE" ? "Image is too large (max 8 MB)" : err.message || "Upload failed";
        res.status(400).json({ message });
    });
}

/* tiny in-memory limiter for the (public) reference-image upload: 30 per IP per hour */
const hits = new Map();
function limitCustomUploads(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < 60 * 60 * 1000);
    if (recent.length >= 30) return res.status(429).json({ message: "Too many uploads. Please try again later." });
    recent.push(now);
    hits.set(key, recent);
    next();
}

/* GET /api/designs - full list, or paged when ?page / ?limit is present */
router.get("/", async (req, res) => {
    try {
        const paged = req.query.page !== undefined || req.query.limit !== undefined;
        if (!paged) return res.json(await listAllDesigns());

        res.json(await listDesignsPaged({
            page: req.query.page,
            limit: req.query.limit,
            category: String(req.query.category || "all"),
            sort: req.query.sort,
            seed: req.query.seed,
            q: req.query.q,
            featured: req.query.featured,
        }));
    } catch (err) {
        console.error("GET /designs failed:", err);
        res.json({ items: [], total: 0, page: 1, limit: 12, hasMore: false });
    }
});

/* GET /api/designs/summary */
router.get("/summary", async (req, res) => {
    try {
        res.json(await designSummary(req.query.seed));
    } catch (err) {
        console.error("GET /designs/summary failed:", err);
        res.json({ total: 0, categories: {} });
    }
});

/* POST /api/designs/custom-image - customer reference photo for a custom request */
router.post("/custom-image", limitCustomUploads, uploadImage, async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "Image required (JPG, PNG or WebP)" });
        res.status(201).json(await createCustomImage(req.file));
    } catch (err) {
        console.error("POST /designs/custom-image failed:", err);
        res.status(500).json({ message: err.message });
    }
});

/* GET /api/designs/admin?industry=key - the items of an industry an admin works in (not just the live one) */
router.get("/admin", ...adminOnly, async (req, res) => {
    try {
        const industry = String(req.query.industry || getProfile().industry);
        if (!(await canAccessIndustry(req.user, industry))) {
            return res.status(403).json({ message: "You are not assigned to this industry" });
        }
        res.json(await listDesignsPaged({
            page: req.query.page, limit: req.query.limit, category: String(req.query.category || "all"),
            sort: req.query.sort, seed: req.query.seed, q: req.query.q, featured: req.query.featured, industry,
        }));
    } catch (err) {
        console.error("GET /designs/admin failed:", err);
        res.status(500).json({ message: err.message });
    }
});

/* GET /api/designs/:id */
router.get("/:id", async (req, res) => {
    try {
        const design = await getDesign(req.params.id);
        if (!design) return res.status(404).json({ message: "Design not found" });
        res.json(design);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* POST /api/designs - admin: add a catalogue design (image saved in /uploads/designs/<category>) */
router.post("/", ...adminOnly, uploadImage, async (req, res) => {
    try {
        // an Admin may only add items to categories of THEIR industries
        const cat = await getCategoryAny(req.body?.categoryId);
        if (cat && !(await canAccessIndustry(req.user, cat.industryKey))) {
            return res.status(403).json({ message: "You are not assigned to this industry" });
        }
        const design = await createDesign({ file: req.file, ...req.body }, req.user.id);

        notifyUsers({
            id: Date.now().toString(),
            title: `New ${getProfile().item} added`,
            body: `${design.name} - ${design.categoryName}`,
            designId: design.id,
            at: new Date().toISOString(),
        }, currentIndustry().slug);
        res.status(201).json(design);
    } catch (err) {
        console.error("POST /designs failed:", err);
        res.status(err.status || 500).json({ message: err.message });
    }
});

/* DELETE /api/designs/:id - admin */
router.delete("/:id", ...adminOnly, async (req, res) => {
    try {
        const removed = await deleteDesign(req.params.id, req.user);
        if (!removed) return res.status(404).json({ message: "Design not found" });
        res.json({ message: "Design removed", id: removed.id });
    } catch (err) {
        console.error("DELETE /designs failed:", err);
        res.status(err.status || 500).json({ message: err.message });
    }
});

export default router;
