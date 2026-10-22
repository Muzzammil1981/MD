import { query, withTransaction } from "../db/pool.js";
import { getProfile } from "../config/industries.js";

/* =========================================================
   Categories belong to an INDUSTRY. The public site, the admin forms and the catalogue
   only use the categories of the ACTIVE industry; the SuperAdmin can still prepare the
   categories of any other industry in the Business tab.
   ========================================================= */
const TTL = 5 * 60 * 1000;
let cache = new Map();                                   // industryKey -> { list, at }
export const invalidateCategories = () => { cache = new Map(); };
const activeKey = () => getProfile().industry;

const toPublic = (r) => ({
    id: r.Id, name: r.Name, shortName: r.ShortName, folder: r.FolderName, description: r.Description, accent: r.Accent,
});

/** Categories of the active industry (what customers and the admin forms see). */
export async function listCategories(industryKey = activeKey()) {
    const hit = cache.get(industryKey);
    if (hit && Date.now() - hit.at < TTL) return hit.list;
    const rows = await query(
        `SELECT * FROM mehndi.Categories WHERE IndustryKey = @k ORDER BY SortOrder, Name`, { k: industryKey });
    const list = rows.map(toPublic);
    cache.set(industryKey, { list, at: Date.now() });
    return list;
}

/** A category of ANY industry (with its industryKey) - used to check who may add items to it. */
export async function getCategoryAny(id) {
    const rows = await query(`SELECT * FROM mehndi.Categories WHERE Id = @id`, { id });
    return rows[0] ? { ...toPublic(rows[0]), industryKey: rows[0].IndustryKey } : null;
}

export async function getCategory(id) {
    return (await listCategories()).find((c) => c.id === id) || null;
}

/* =========================================================
   SuperAdmin: manage the categories of an industry
   ========================================================= */
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const slug = (t) => String(t).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const toAdmin = (r) => ({
    id: r.Id, name: r.Name, shortName: r.ShortName, description: r.Description, accent: r.Accent,
    sortOrder: r.SortOrder, designCount: r.DesignCount, industryKey: r.IndustryKey,
});

export async function listCategoriesAdmin(industryKey = activeKey()) {
    const rows = await query(
        `SELECT c.*, (SELECT COUNT(*) FROM mehndi.Designs d WHERE d.CategoryId = c.Id) AS DesignCount
         FROM mehndi.Categories c WHERE c.IndustryKey = @k ORDER BY c.SortOrder, c.Name`, { k: industryKey });
    return rows.map(toAdmin);
}

function clean({ name, shortName, description, accent }) {
    const n = String(name || "").trim();
    if (n.length < 2 || n.length > 100) throw fail("Category name must be 2-100 characters");
    return {
        name: n,
        shortName: String(shortName || "").trim().slice(0, 50) || n.slice(0, 50),
        description: String(description || "").trim().slice(0, 500),
        accent: String(accent || "").trim().slice(0, 100),
    };
}

/* Ids are global (designs reference them) - make a new one unique */
async function uniqueId(base) {
    const root = slug(base).slice(0, 40) || "category";
    let id = root;
    for (let i = 2; (await query(`SELECT 1 AS x FROM mehndi.Categories WHERE Id = @id`, { id }))[0]; i++) id = `${root}-${i}`;
    return id;
}

export async function createCategory(input, industryKey = activeKey()) {
    const c = clean(input);
    const id = await uniqueId(c.name);
    const max = (await query(`SELECT ISNULL(MAX(SortOrder), 0) AS M FROM mehndi.Categories WHERE IndustryKey = @k`, { k: industryKey }))[0].M;
    await query(
        `INSERT INTO mehndi.Categories (Id, Name, ShortName, FolderName, Description, Accent, SortOrder, IndustryKey)
         VALUES (@id, @n, @s, @s, @d, @a, @o, @k)`,
        { id, n: c.name, s: c.shortName, d: c.description, a: c.accent, o: max + 1, k: industryKey });
    invalidateCategories();
    return (await listCategoriesAdmin(industryKey)).find((x) => x.id === id);
}

export async function updateCategory(id, input) {
    const c = clean(input);
    const rows = await query(
        `UPDATE mehndi.Categories SET Name=@n, ShortName=@s, FolderName=@s, Description=@d, Accent=@a
         OUTPUT INSERTED.IndustryKey WHERE Id=@id`,
        { id, n: c.name, s: c.shortName, d: c.description, a: c.accent });
    if (!rows[0]) throw fail("Category not found", 404);
    invalidateCategories();
    return (await listCategoriesAdmin(rows[0].IndustryKey)).find((x) => x.id === id);
}

/** Delete a category. If items use it they must be moved to another category of the SAME industry. */
export async function deleteCategory(id, moveTo) {
    await withTransaction(async (tx) => {
        const cat = await query(`SELECT Id, IndustryKey FROM mehndi.Categories WHERE Id = @id`, { id }, tx);
        if (!cat[0]) throw fail("Category not found", 404);
        const used = (await query(`SELECT COUNT(*) AS N FROM mehndi.Designs WHERE CategoryId = @id`, { id }, tx))[0].N;
        if (used > 0) {
            if (!moveTo) throw fail(`${used} item(s) use this category. Choose a category to move them to first.`);
            if (moveTo === id) throw fail("Choose a different category to move them to");
            const target = await query(
                `SELECT Id FROM mehndi.Categories WHERE Id = @t AND IndustryKey = @k`, { t: moveTo, k: cat[0].IndustryKey }, tx);
            if (!target[0]) throw fail("Choose a category of the same industry");
            await query(`UPDATE mehndi.Designs SET CategoryId = @t WHERE CategoryId = @id`, { t: moveTo, id }, tx);
        }
        await query(`DELETE FROM mehndi.Categories WHERE Id = @id`, { id }, tx);
    });
    invalidateCategories();
    return { ok: true };
}

export async function reorderCategories(ids) {
    if (!Array.isArray(ids) || !ids.length) throw fail("Nothing to reorder");
    await withTransaction(async (tx) => {
        for (const [i, id] of ids.entries()) {
            await query(`UPDATE mehndi.Categories SET SortOrder = @o WHERE Id = @id`, { o: i + 1, id: String(id) }, tx);
        }
    });
    invalidateCategories();
}

/** Add the industry's starter categories that it doesn't have yet (matched by name). */
export async function addStarterCategories(industryKey, starters) {
    const have = new Set((await listCategoriesAdmin(industryKey)).map((c) => c.name.toLowerCase()));
    let added = 0;
    for (const s of starters) {
        if (have.has(s.name.toLowerCase())) continue;
        await createCategory({ name: s.name, shortName: s.shortName, description: s.description, accent: s.accent }, industryKey);
        added++;
    }
    return { added, categories: await listCategoriesAdmin(industryKey) };
}
