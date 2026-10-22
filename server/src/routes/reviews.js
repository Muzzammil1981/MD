import express from "express";
import { requireAuth, requireAdmin, ROLES } from "../middleware/auth.js";
import { notifyAdmins } from "../socket.js";
import {
    listPublic, listMine, createReview, updateMyReview, deleteMyReview, listForAdmin, setHidden,
} from "../services/reviewService.js";

const router = express.Router();

/* ---------- PUBLIC: home page (all) or one design (?designId=) ---------- */
router.get("/", async (req, res) => {
    try {
        res.json(await listPublic({
            designId: req.query.designId ? String(req.query.designId) : null,
            page: req.query.page,
            limit: req.query.limit,
        }));
    } catch (err) {
        console.error("GET /reviews failed:", err.message);
        res.json({ count: 0, average: 0, page: 1, hasMore: false, items: [] });
    }
});

/* ---------- Customer: my reviews (so My Orders knows which orders are reviewed) ---------- */
router.get("/mine", requireAuth, async (req, res) => {
    try { res.json(await listMine(req.user.id)); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", requireAuth, async (req, res) => {
    try {
        if (req.user.role !== ROLES.USER) return res.status(403).json({ message: "Only customers can write reviews" });
        const { orderId, rating, comment } = req.body || {};
        const { review, ownerId, industryKey, username } = await createReview({ user: req.user, orderId, rating, comment });
        notifyAdmins({ ownerId, industryKey }, {
            type: "review",
            title: `⭐ New ${review.rating}-star review`,
            body: `${username}: ${review.comment ? review.comment.slice(0, 80) : "(no comment)"}`,
            at: new Date().toISOString(),
        });
        res.status(201).json(review);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.patch("/:id", requireAuth, async (req, res) => {
    try { res.json(await updateMyReview({ user: req.user, id: req.params.id, ...req.body })); }
    catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete("/:id", requireAuth, async (req, res) => {
    try { res.json(await deleteMyReview({ user: req.user, id: req.params.id })); }
    catch (err) { res.status(400).json({ message: err.message }); }
});

/* ---------- Admin moderation (declared AFTER the /:id routes would clash, so distinct paths) ---------- */
router.get("/admin/all", requireAuth, requireAdmin, async (req, res) => {
    try { res.json(await listForAdmin(req.user)); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch("/admin/:id/hidden", requireAuth, requireAdmin, async (req, res) => {
    try { res.json(await setHidden({ user: req.user, id: req.params.id, hidden: req.body?.hidden })); }
    catch (err) { res.status(err.status || 400).json({ message: err.message }); }
});

export default router;
