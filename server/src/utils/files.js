import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* All uploaded images live here. Default: <server>/uploads */
export const UPLOAD_DIR = path.resolve(
    process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads")
);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const THUMB_WIDTH = 640;

export function slugify(v) {
    return String(v).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** "/uploads/designs/arabic/x.webp" → absolute path on disk (traversal-safe). */
export function toAbsolute(publicPath) {
    if (!publicPath || !publicPath.startsWith("/uploads/")) return null;
    const abs = path.resolve(UPLOAD_DIR, publicPath.slice("/uploads/".length));
    if (!abs.startsWith(UPLOAD_DIR + path.sep)) return null;
    return abs;
}

function optimize(buffer) {
    return sharp(buffer)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
}

function makeThumb(buffer) {
    return sharp(buffer)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
}

/**
 * Save an uploaded image + its thumbnail under /uploads/<subDir>/.
 * Returns the PUBLIC paths that get stored in the database.
 *   subDir "designs/arabic" → /uploads/designs/arabic/<id>.webp
 *                             /uploads/designs/arabic/thumbs/<id>.webp
 */
export async function saveImage({ buffer, mimetype, originalName, subDir, id }) {
    const dir = path.join(UPLOAD_DIR, subDir);
    const thumbDir = path.join(dir, "thumbs");
    await fsp.mkdir(thumbDir, { recursive: true });

    let fullBuf, thumbBuf, ext, contentType;
    try {
        fullBuf = await optimize(buffer);
        thumbBuf = await makeThumb(buffer);
        ext = "webp";
        contentType = "image/webp";
    } catch (err) {
        // sharp couldn't process it - keep the original so the upload still works
        console.warn("sharp failed, storing original:", err.message);
        fullBuf = buffer;
        thumbBuf = buffer;
        ext = (path.extname(originalName || "").slice(1) || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        contentType = mimetype || "image/jpeg";
    }

    const fileName = `${id}.${ext}`;
    await fsp.writeFile(path.join(dir, fileName), fullBuf);
    await fsp.writeFile(path.join(thumbDir, fileName), thumbBuf);

    const base = `/uploads/${subDir.split(path.sep).join("/")}`;
    return {
        imagePath: `${base}/${fileName}`,
        thumbPath: `${base}/thumbs/${fileName}`,
        contentType,
    };
}

/** Save a single raw file (used for the optional static UPI QR image). */
export async function saveRawFile({ buffer, subDir, fileName }) {
    const dir = path.join(UPLOAD_DIR, subDir);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(path.join(dir, fileName), buffer);
    return `/uploads/${subDir.split(path.sep).join("/")}/${fileName}`;
}

/** Delete one or more files by public path; missing files are ignored. */
export async function removeFiles(...publicPaths) {
    for (const p of publicPaths.flat()) {
        const abs = toAbsolute(p);
        if (!abs) continue;
        try { await fsp.unlink(abs); }
        catch (err) { if (err.code !== "ENOENT") console.warn("unlink failed:", abs, err.message); }
    }
}
