import QRCode from "qrcode";
import crypto from "crypto";
import { query } from "../db/pool.js";
import { saveRawFile, removeFiles } from "../utils/files.js";
import { getProfile } from "../config/industries.js";

/* ---------------------------------------------------------------
   Payment settings
   - SuperAdmin  → StudioSettings (single row): used for normal (home page) bookings
   - each Admin  → AdminSettings (one row per admin): used for THEIR events only
   An admin with no UPI configured does NOT fall back to the studio's UPI.
   --------------------------------------------------------------- */
const rowToSettings = (r) => ({
    upiId: r?.UpiId || "",
    merchantName: r?.MerchantName || getProfile().name,
    staticQrUrl: r?.QrImagePath || null,
});

export async function getStudioSettings() {
    const rows = await query(`SELECT * FROM mehndi.StudioSettings WHERE Id = 1`);
    return rowToSettings(rows[0]);
}

async function getAdminSettings(adminId) {
    const rows = await query(`SELECT * FROM mehndi.AdminSettings WHERE AdminId = @id`, { id: adminId });
    return rowToSettings(rows[0]);
}

const isStudio = (user) => user.role === "SUPERADMIN";

/** The settings the signed-in admin edits on their dashboard */
export async function getSettingsForUser(user) {
    return isStudio(user) ? getStudioSettings() : getAdminSettings(user.id);
}

export async function saveSettingsForUser(user, { upiId, merchantName }) {
    if (isStudio(user)) {
        await query(
            `UPDATE mehndi.StudioSettings SET UpiId=@u, MerchantName=@m, UpdatedAt=SYSUTCDATETIME() WHERE Id = 1`,
            { u: upiId, m: merchantName });
    } else {
        await query(
            `UPDATE mehndi.AdminSettings SET UpiId=@u, MerchantName=@m, UpdatedAt=SYSUTCDATETIME() WHERE AdminId=@id;
             IF @@ROWCOUNT = 0
                 INSERT INTO mehndi.AdminSettings (AdminId, UpiId, MerchantName) VALUES (@id, @u, @m);`,
            { id: user.id, u: upiId, m: merchantName });
    }
    return getSettingsForUser(user);
}

/** Payment details that apply to ONE order: its event owner's, or the studio's for normal bookings */
export async function getSettingsForOrder(order) {
    if (!order.eventId || !order.eventOwnerId) return getStudioSettings();
    const owner = await query(`SELECT Role FROM mehndi.Users WHERE Id = @id`, { id: order.eventOwnerId });
    if (!owner[0] || owner[0].Role === "SUPERADMIN") return getStudioSettings();
    return getAdminSettings(order.eventOwnerId);
}

/* Optional static QR image - saved in /uploads/settings, path kept in the table */
export async function uploadQrCode(user, { buffer, mimeType }) {
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const old = (await getSettingsForUser(user)).staticQrUrl;

    // unique name so browsers never show a stale cached QR
    const fileName = `upi-qr-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.${ext}`;
    const publicPath = await saveRawFile({ buffer, subDir: "settings", fileName });

    if (isStudio(user)) {
        await query(`UPDATE mehndi.StudioSettings SET QrImagePath=@p, UpdatedAt=SYSUTCDATETIME() WHERE Id = 1`, { p: publicPath });
    } else {
        await query(
            `UPDATE mehndi.AdminSettings SET QrImagePath=@p, UpdatedAt=SYSUTCDATETIME() WHERE AdminId=@id;
             IF @@ROWCOUNT = 0
                 INSERT INTO mehndi.AdminSettings (AdminId, QrImagePath) VALUES (@id, @p);`,
            { id: user.id, p: publicPath });
    }
    if (old) await removeFiles(old);
    return { path: publicPath };
}

/* ---------- Dynamic QR with the amount pre-filled ----------
   UPI deep link (NPCI spec):
   upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<note>&tr=<txnref> */
export function buildUpiUri({ upiId, merchantName, amount, note, txnRef }) {
    if (!upiId) throw new Error("UPI ID not configured");
    const params = new URLSearchParams({
        pa: upiId,
        pn: merchantName || getProfile().name,
        am: Number(amount).toFixed(2),
        cu: "INR",
    });
    if (note) params.set("tn", note);
    if (txnRef) params.set("tr", txnRef);
    return `upi://pay?${params.toString()}`;
}

/** Returns a data URL (base64 PNG) of the dynamic QR. */
export async function generateDynamicQr({ upiId, merchantName, amount, note, txnRef }) {
    const uri = buildUpiUri({ upiId, merchantName, amount, note, txnRef });
    const dataUrl = await QRCode.toDataURL(uri, {
        width: 500,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#24170f", light: "#fffdf9" },
    });
    return { uri, dataUrl };
}
