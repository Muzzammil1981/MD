import express from "express";
import { requireAuth, signToken, ROLES } from "../middleware/auth.js";
import { loginUser, getUserById } from "../services/userService.js";

const router = express.Router();

/* Admin portal login (/admin): ADMIN and SUPERADMIN accounts, stored in the Users table */
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = await loginUser(
            { identifier: username, password },
            [ROLES.ADMIN, ROLES.SUPERADMIN]
        );
        res.json({ token: signToken(user), user });
    } catch (err) {
        const msg = err.message === "Invalid credentials" ? "Invalid username or password" : err.message;
        res.status(401).json({ message: msg });
    }
});

/* Current admin (from JWT) - fresh from the DB so role/active changes show immediately */
router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await getUserById(req.user.id);
        if (!user || !user.active) return res.status(401).json({ message: "Account disabled or removed" });
        res.json({ user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
