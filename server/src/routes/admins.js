import express from "express";
import { superAdminOnly } from "../middleware/auth.js";
import { disconnectUser } from "../socket.js";
import {
    listAdmins, createAdmin, updateAdmin, resetAdminPassword, deleteAdmin, setAdminIndustries,
} from "../services/userService.js";
import { syncAdminRooms } from "../socket.js";

/* SuperAdmin-only: create and manage ADMIN accounts */
const router = express.Router();
router.use(...superAdminOnly);

router.get("/", async (_req, res) => {
    try { res.json(await listAdmins()); }
    catch (err) { res.status(500).json({ message: err.message }); }
});

router.post("/", async (req, res) => {
    try {
        const admin = await createAdmin({ ...(req.body || {}), createdBy: req.user.id });
        res.status(201).json(admin);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/* edit name / email, enable or disable */
router.patch("/:id", async (req, res) => {
    try {
        const { fullName, email, active } = req.body || {};
        const admin = await updateAdmin({ id: req.params.id, fullName, email, active });
        if (admin.active === false) disconnectUser(admin.id); // kick live sockets
        res.json(admin);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/* which industries this admin may work in (orders, reviews, reports and catalogue are limited to them) */
router.put("/:id/industries", async (req, res) => {
    try {
        const out = await setAdminIndustries(req.params.id, req.body?.industries);
        await syncAdminRooms(req.params.id, out.keys);          // live alerts follow the change at once
        res.json(out);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.post("/:id/reset-password", async (req, res) => {
    try {
        res.json(await resetAdminPassword({ id: req.params.id, newPassword: req.body?.newPassword }));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        await deleteAdmin(req.params.id, req.user.id);   // their events/designs move to the SuperAdmin
        disconnectUser(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

export default router;
