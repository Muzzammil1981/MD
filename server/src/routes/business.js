import express from "express";
import { superAdminOnly } from "../middleware/auth.js";
import {
    listIndustries, setActiveIndustry, createIndustry, deleteIndustry,
    getEditable, saveLabels, resetLabels, starterCategoriesFor, industryExists,
} from "../services/industryService.js";
import { getProfile } from "../config/industries.js";
import {
    listCategoriesAdmin, createCategory, updateCategory, deleteCategory, reorderCategories, addStarterCategories,
} from "../services/categoryService.js";

/* SuperAdmin only: choose / add industries, edit their wording, manage categories */
const router = express.Router();
router.use(...superAdminOnly);

const run = (fn) => async (req, res) => {
    try { res.json(await fn(req)); }
    catch (err) { res.status(err.status || 400).json({ message: err.message }); }
};

/* ----- industries ----- */
router.get("/industries", run(() => listIndustries()));
router.put("/active", run((req) => setActiveIndustry(req.body?.key)));
router.post("/industries", run((req) => createIndustry({ ...req.body, createdBy: req.user.id })));
router.delete("/industries/:key", run((req) => deleteIndustry(req.params.key)));

/* ----- wording of one industry ----- */
router.get("/industries/:key/labels", run((req) => getEditable(req.params.key)));
router.put("/industries/:key/labels", run((req) => saveLabels(req.params.key, req.body?.labels)));
router.post("/industries/:key/labels/reset", run((req) => resetLabels(req.params.key)));

/* ----- categories (of one industry: ?industry=key, default = the active one) ----- */
async function industryOf(req) {
    const key = String(req.query.industry || req.body?.industry || getProfile().industry);
    if (!(await industryExists(key))) throw Object.assign(new Error("Unknown industry"), { status: 404 });
    return key;
}
router.get("/categories", run(async (req) => listCategoriesAdmin(await industryOf(req))));
router.post("/categories", run(async (req) => createCategory(req.body || {}, await industryOf(req))));
router.post("/categories/starter", run(async (req) => {
    const key = await industryOf(req);
    return addStarterCategories(key, await starterCategoriesFor(key));
}));
router.post("/categories/import", run(async (req) => {
    const key = await industryOf(req);
    const list = Array.isArray(req.body?.categories) ? req.body.categories : [];
    if (!list.length) throw Object.assign(new Error("No categories to add"), { status: 400 });
    if (list.length > 30) throw Object.assign(new Error("Too many categories (max 30)"), { status: 400 });
    const clean = list.map((c) => ({
        name: String(c.name || "").trim().slice(0, 100),
        shortName: String(c.shortName || "").trim().slice(0, 50),
        description: String(c.description || "").trim().slice(0, 500),
        accent: String(c.accent || "").trim().slice(0, 100),
    })).filter((c) => c.name.length >= 2);
    return addStarterCategories(key, clean);   // skips names that already exist
}));
router.put("/categories/order", run(async (req) => { await reorderCategories(req.body?.ids); return { ok: true }; }));
router.patch("/categories/:id", run((req) => updateCategory(req.params.id, req.body || {})));
router.delete("/categories/:id", run((req) => deleteCategory(req.params.id, req.query.moveTo)));

export default router;
