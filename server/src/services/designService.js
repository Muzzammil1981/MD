import { query, iso } from "../db/pool.js";
import { listCategories, getCategoryAny } from "./categoryService.js";
import { saveImage, removeFiles, slugify } from "../utils/files.js";
import { clamp, mulberry32, seededShuffle, likeEscape } from "../utils/misc.js";
import { getProfile } from "../config/industries.js";
import { canAccessIndustry } from "./adminAccess.js";

const SELECT_DESIGN = `
    SELECT d.Id, d.Name, d.Description, d.Price, d.AmountType, d.CategoryId, c.Name AS CategoryName,
           d.Featured, d.ImagePath, d.ThumbPath, d.CreatedAt,
           d.UploadedBy, u.Username AS UploadedByName, d.DurationMinutes
    FROM mehndi.Designs d
    JOIN mehndi.Categories c ON c.Id = d.CategoryId
    LEFT JOIN mehndi.Users u ON u.Id = d.UploadedBy`;

export function toDesign(r) {
    return {
        id: r.Id,
        name: r.Name,
        description: r.Description,
        price: Number(r.Price),
        amountType: r.AmountType,
        categoryId: r.CategoryId,
        categoryName: r.CategoryName,
        featured: r.Featured === true,
        image: r.ImagePath,      // /uploads/designs/<category>/<id>.webp
        thumb: r.ThumbPath,      // /uploads/designs/<category>/thumbs/<id>.webp
        createdAt: iso(r.CreatedAt),
        durationMinutes: r.DurationMinutes || 60,   // how long this takes (used by slot booking)
        uploadedById: r.UploadedBy || null,        // which admin uploaded this design
        uploadedBy: r.UploadedByName || null,
    };
}

export async function listAllDesigns(industry = getProfile().industry) {
    const rows = await query(`${SELECT_DESIGN} WHERE c.IndustryKey = @ind ORDER BY d.CreatedAt DESC`, { ind: industry });
    return rows.map(toDesign);
}

export async function getDesign(id) {
    const rows = await query(`${SELECT_DESIGN} WHERE d.Id = @id`, { id });
    return rows[0] ? toDesign(rows[0]) : null;
}

/* Paged / filtered list (same query-string contract as before) */
export async function listDesignsPaged({ page, limit, category, sort, seed, q, featured, industry = getProfile().industry }) {
    const lim = clamp(parseInt(limit, 10) || 12, 1, 60);
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const tokens = String(q || "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);

    const where = [`c.IndustryKey = @ind`];          // only the active industry's categories
    const params = { ind: industry };
    if (category && category !== "all") { where.push(`d.CategoryId = @cat`); params.cat = category; }
    if (featured === "true") where.push(`d.Featured = 1`);
    tokens.forEach((t, i) => {
        params[`t${i}`] = `%${likeEscape(t)}%`;
        where.push(
            `(d.Name LIKE @t${i} ESCAPE '\\' OR d.Description LIKE @t${i} ESCAPE '\\' OR c.Name LIKE @t${i} ESCAPE '\\')`
        );
    });

    const rows = await query(
        `${SELECT_DESIGN} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY d.CreatedAt DESC`,
        params
    );
    let list = rows.map(toDesign);

    const sortMode = String(sort || "newest");
    if (sortMode === "random") list = seededShuffle(list, parseInt(seed, 10) || 1);
    else if (sortMode === "oldest") list = [...list].reverse();

    const total = list.length;
    const start = (pg - 1) * lim;
    const items = list.slice(start, start + lim);
    return { items, total, page: pg, limit: lim, hasMore: start + items.length < total };
}

/* Per-category count + a (seeded) random cover design */
export async function designSummary(seed) {
    const all = await listAllDesigns();
    const rand = mulberry32(parseInt(seed, 10) || 1);

    const groups = {};
    for (const d of all) (groups[d.categoryId] ||= []).push(d);

    const out = {};
    for (const c of await listCategories()) {
        const list = groups[c.id];
        if (!list?.length) continue;
        out[c.id] = { count: list.length, cover: list[Math.floor(rand() * list.length)] };
    }
    return { total: all.length, categories: out };
}

export async function createDesign({ file, name, description, price, amountType, categoryId, featured, durationMinutes }, uploadedBy) {
    const duration = Math.round(Number(durationMinutes) || 60);
    if (duration < 5 || duration > 600) throw Object.assign(new Error("Duration must be between 5 and 600 minutes"), { status: 400 });
    const category = await getCategoryAny(categoryId);   // the route already checked the admin may use this industry
    if (!category) throw Object.assign(new Error("Valid category required"), { status: 400 });
    if (!name?.trim()) throw Object.assign(new Error("Design name required"), { status: 400 });
    if (!file) throw Object.assign(new Error("Design image required (JPG, PNG or WebP only)"), { status: 400 });

    const id = `${slugify(name) || "design"}-${Date.now()}`;
    const saved = await saveImage({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalName: file.originalname,
        subDir: `designs/${category.id}`,
        id,
    });

    try {
        await query(
            `INSERT INTO mehndi.Designs (Id, Name, Description, Price, AmountType, CategoryId, Featured, ImagePath, ThumbPath, UploadedBy, DurationMinutes)
             VALUES (@id, @name, @desc, @price, @amt, @cat, @feat, @img, @thumb, @by, @dur)`,
            {
                id,
                name: name.trim(),
                desc: String(description || "").trim(),
                price: Number(price || 0),
                amt: amountType || "per design",
                cat: category.id,
                feat: featured === "true" || featured === true,
                img: saved.imagePath,
                thumb: saved.thumbPath,
                by: uploadedBy || null,
                dur: duration,
            }
        );
    } catch (err) {
        await removeFiles(saved.imagePath, saved.thumbPath); // don't leave orphan files
        throw err;
    }
    return getDesign(id);
}

export async function deleteDesign(id, user) {
    const design = await getDesign(id);
    if (!design) return null;
    if (user && user.role !== "SUPERADMIN") {
        if (design.uploadedById !== user.id) throw Object.assign(new Error("You can only delete items you uploaded"), { status: 403 });
        const cat = await getCategoryAny(design.categoryId);
        if (!(await canAccessIndustry(user, cat?.industryKey))) throw Object.assign(new Error("You are not assigned to this industry"), { status: 403 });
    }
    await query(`DELETE FROM mehndi.Designs WHERE Id = @id`, { id });
    await removeFiles(design.image, design.thumb);
    return design;
}

/* ---------- Customer reference images for custom requests ---------- */
export async function createCustomImage(file) {
    const safe = slugify(file.originalname.replace(/\.[^.]+$/, "")) || "reference";
    const id = `custom-${safe}-${Date.now()}`;
    const saved = await saveImage({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalName: file.originalname,
        subDir: "custom",
        id,
    });
    await query(
        `INSERT INTO mehndi.CustomImages (Id, ImagePath, ThumbPath, ContentType) VALUES (@id, @img, @thumb, @ct)`,
        { id, img: saved.imagePath, thumb: saved.thumbPath, ct: saved.contentType }
    );
    return { imageId: id, image: saved.imagePath };
}
