import express from "express";
import { requireAuth, requireAdmin, signToken, ROLES } from "../middleware/auth.js";
import {
    registerUser, loginUser, listCustomers, getUserById,
    changePassword, adminResetCustomerPassword,
} from "../services/userService.js";

const router = express.Router();

/* ---------- Customer site ---------- */
router.post("/register", async (req, res) => {
    try {
        const user = await registerUser(req.body || {});
        res.status(201).json({ token: signToken(user), user });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const user = await loginUser(req.body || {}, [ROLES.USER]);
        res.json({ token: signToken(user), user });
    } catch (err) {
        res.status(401).json({ message: err.message });
    }
});

router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        if (!user) return res.status(401).json({ message: "User not found" });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* Any signed-in account (customer, admin, superadmin) changes its OWN password */
router.post("/change-password", requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};
        await changePassword({ userId: req.user.id, currentPassword, newPassword });
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/* ---------- Admin / SuperAdmin ---------- */
router.get("/", requireAuth, requireAdmin, async (_req, res) => {
    try { res.json(await listCustomers()); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
    try {
        res.json(await adminResetCustomerPassword({ userId: req.params.id, newPassword: req.body?.newPassword }));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
