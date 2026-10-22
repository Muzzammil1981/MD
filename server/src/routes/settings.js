import express from "express";
import multer from "multer";
import { adminOnly } from "../middleware/auth.js";
import { getStudioSettings, getSettingsForUser, saveSettingsForUser, uploadQrCode } from "../services/settingsService.js";
import { getProfile } from "../config/industries.js";

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        cb(null, ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.mimetype));
    },
});

/* Public - customers need the UPI id + merchant name */
router.get("/public", async (_req, res) => {
    try {
        const s = await getStudioSettings();
        res.json({ upiId: s.upiId, merchantName: s.merchantName });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* Admin - MY payment settings (an admin's own; the SuperAdmin's are the studio's) */
router.get("/", ...adminOnly, async (req, res) => {
    try {
        const s = await getSettingsForUser(req.user);
        res.json({ ...s, staticQrFileId: s.staticQrUrl });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/", ...adminOnly, async (req, res) => {
    try {
        const { upiId, merchantName } = req.body || {};
        if (!upiId?.trim()) return res.status(400).json({ message: "UPI ID is required" });
        const s = await saveSettingsForUser(req.user, {
            upiId: upiId.trim(),
            merchantName: (merchantName || getProfile().name).trim(),
        });
        res.json({ ok: true, ...s });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

/* Admin - optional static QR image (saved in /uploads/settings) */
router.post("/qr", ...adminOnly, upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "QR image required" });
        const { path } = await uploadQrCode(req.user, { buffer: req.file.buffer, mimeType: req.file.mimetype });
        res.json({ ok: true, staticQrUrl: path, staticQrFileId: path });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
