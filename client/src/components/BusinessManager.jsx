import { useEffect, useState } from "react";
import {
    Briefcase, Plus, Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Loader2, AlertCircle,
    CheckCircle2, RefreshCw, RotateCcw, ChevronDown, Wand2, Tag, Sparkles, Copy, Eye, FileText, Globe, ExternalLink,
} from "lucide-react";
import { api } from "../lib/api";
import { B } from "../lib/brand";
import WordingPreview from "./WordingPreview";
import { buildPrompt, parseReply } from "../lib/wordingAI";

const card = "rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm sm:p-6";
const input = "w-full rounded-xl border border-[#ddcdb8] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]";
const btnDark = "inline-flex items-center justify-center gap-2 rounded-full bg-[#24170f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#382419] disabled:opacity-60";
const btnLight = "inline-flex items-center justify-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2 text-xs font-semibold text-[#5b4636] transition hover:bg-[#f4eadc] disabled:opacity-60";
const msgOf = (e, d) => e.response?.data?.message || d;

/* Keep the app-wide labels in sync after the SuperAdmin edits categories (no reload needed for the admin forms) */
function syncCategories(list) {
    B.categories = list.map((c) => ({ id: c.id, name: c.name, shortName: c.shortName, description: c.description, accent: c.accent }));
    B.firstCategoryId = B.categories[0]?.id || "";
}

export default function BusinessManager() {
    const [toast, setToast] = useState({ type: "", text: "" });
    const [needsReload, setNeedsReload] = useState(false);
    const [industries, setIndustries] = useState({ active: "", industries: [] });
    const [editKey, setEditKey] = useState("");
    const [catVersion, setCatVersion] = useState(0);   // bump → Categories panel reloads

    const flash = (type, text) => { setToast({ type, text }); setTimeout(() => setToast({ type: "", text: "" }), 4000); };
    const loadIndustries = async () => {
        const { data } = await api.get("/api/business/industries");
        setIndustries(data);
        setEditKey((k) => k || data.active);
    };
    useEffect(() => { loadIndustries().catch((e) => flash("err", msgOf(e, "Could not load industries"))); }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="serif text-2xl font-semibold">Business setup</h2>
                <p className="text-sm text-[#715e4e]">
                    Choose what kind of business this is, edit the wording customers see, and manage your categories. Only the SuperAdmin can change these.
                </p>
            </div>

            {toast.text && (
                <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${toast.type === "ok" ? "bg-[#d6efdc] font-semibold text-[#1d7a3e]" : "bg-[#f8e4df] text-[#8c392d]"}`}>
                    {toast.type === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />} {toast.text}
                </div>
            )}
            {needsReload && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f0d98c] bg-[#fdf3d6] px-4 py-3 text-sm text-[#8a6d1c]">
                    <span>Saved. Reload the page to see the new wording everywhere.</span>
                    <button onClick={() => window.location.reload()} className={btnDark}><RefreshCw size={14} /> Reload now</button>
                </div>
            )}

            <IndustryPanel data={industries} reload={loadIndustries} flash={flash} editKey={editKey} setEditKey={setEditKey} setNeedsReload={setNeedsReload} />
            {editKey && <AddressPanel key={`addr-${editKey}`} biz={industries.industries.find((i) => i.key === editKey)} reload={loadIndustries} flash={flash} />}
            {editKey && <WordingPanel key={editKey} industryKey={editKey} data={industries} flash={flash} setNeedsReload={setNeedsReload} onCategoriesChanged={() => setCatVersion((v) => v + 1)} />}
            {editKey && (
                <CategoriesPanel
                    key={`cat-${editKey}-${catVersion}`}
                    flash={flash}
                    industryKey={editKey}
                    industryName={industries.industries.find((i) => i.key === editKey)?.name || editKey}
                    isActive={editKey === industries.active}
                />
            )}
        </div>
    );
}

/* ------------------------------------------------------------------ industries */
function IndustryPanel({ data, reload, flash, editKey, setEditKey, setNeedsReload }) {
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ name: "", baseKey: "barber" });
    const [busy, setBusy] = useState(false);
    const builtIns = data.industries.filter((i) => i.builtIn);

    const activate = async (key) => {
        setBusy(true);
        try { await api.put("/api/business/active", { key }); await reload(); setEditKey(key); setNeedsReload(true); flash("ok", "Business type changed"); }
        catch (e) { flash("err", msgOf(e, "Could not change")); }
        finally { setBusy(false); }
    };
    const create = async (e) => {
        e.preventDefault(); setBusy(true);
        try {
            const { data: created } = await api.post("/api/business/industries", form);
            setForm({ name: "", baseKey: "barber" }); setAdding(false);
            await reload(); setEditKey(created.key);
            flash("ok", `“${created.name}” added - edit its wording below, then make it active.`);
        } catch (er) { flash("err", msgOf(er, "Could not add industry")); }
        finally { setBusy(false); }
    };
    const remove = async (i) => {
        if (!confirm(`Delete the industry “${i.name}”? Its wording will be lost.`)) return;
        try { await api.delete(`/api/business/industries/${i.key}`); await reload(); flash("ok", "Industry deleted"); }
        catch (er) { flash("err", msgOf(er, "Could not delete")); }
    };

    return (
        <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Briefcase size={18} className="text-[#7d3f24]" /><h3 className="serif text-xl font-semibold">Business type</h3></div>
                <button onClick={() => setAdding(!adding)} className={btnLight}>{adding ? <X size={14} /> : <Plus size={14} />} {adding ? "Cancel" : "Add industry"}</button>
            </div>
            <p className="mt-1 text-xs text-[#715e4e]">Every business has its own address, wording, categories, orders and admins. Click one to edit it below. <strong>Make default</strong> only chooses what old links without an address show.</p>

            {adding && (
                <form onSubmit={create} className="mt-4 grid gap-3 rounded-xl bg-[#faf5ed] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">New industry name
                        <input required className={input} value={form.name} placeholder="e.g. Tattoo studio" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                    <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Start from template
                        <select className={input} value={form.baseKey} onChange={(e) => setForm({ ...form, baseKey: e.target.value })}>
                            {builtIns.map((i) => <option key={i.key} value={i.key}>{i.name}</option>)}
                        </select></label>
                    <button disabled={busy} className={btnDark}>{busy && <Loader2 size={14} className="animate-spin" />} Add</button>
                </form>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.industries.map((i) => {
                    const isActive = data.active === i.key;
                    const isEditing = editKey === i.key;
                    const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
                    return (
                        <div key={i.key} onClick={() => setEditKey(i.key)} role="button" tabIndex={0}
                            onKeyDown={(e) => { if (e.key === "Enter") setEditKey(i.key); }}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3 transition ${isEditing ? "border-[#24170f] ring-2 ring-[#24170f]/15" : "border-[#eadfce] hover:border-[#c9b79e]"} ${isActive ? "bg-[#fdf7ee]" : "bg-white"}`}>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold">{i.name}</div>
                                <div className="text-[11px] text-[#8a6d53]">
                                    {i.builtIn ? "Built-in" : `Custom · from ${i.baseKey}`} · /{i.slug}{!i.published && <span className="ml-1 rounded bg-[#f3e0dc] px-1.5 py-0.5 text-[9px] font-bold text-[#9b3b2b]">Hidden</span>}
                                    {isEditing && <span className="ml-2 font-bold text-[#7d3f24]">· Editing below</span>}
                                </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {isActive
                                    ? <span className="rounded-full bg-[#d6efdc] px-2.5 py-1 text-[10px] font-bold text-[#1d7a3e]">Default</span>
                                    : <button disabled={busy} onClick={stop(() => activate(i.key))} className={btnLight}>Make default</button>}
                                {!i.builtIn && !isActive && <button onClick={stop(() => remove(i))} className="rounded-full border border-[#e6c4be] p-2 text-[#9b3b2b] hover:bg-[#f7e9e6]" title="Delete"><Trash2 size={12} /></button>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ wording */
function WordingPanel({ industryKey, data, flash, setNeedsReload, onCategoriesChanged }) {
    const [state, setState] = useState(null);
    const [values, setValues] = useState({});
    const [open, setOpen] = useState({});
    const [busy, setBusy] = useState(false);
    const [cats, setCats] = useState([]);                 // categories of this industry (for the preview)
    const [pendingCats, setPendingCats] = useState([]);   // categories read from the AI reply, added on Save
    const [view, setView] = useState("form");             // phones: form | preview
    const [ai, setAi] = useState({ open: false, industry: "", details: "", reply: "", report: null, copied: false });
    const isActive = data.active === industryKey;

    const loadCats = () => api.get("/api/business/categories", { params: { industry: industryKey } })
        .then(({ data: d }) => setCats(d)).catch(() => { });

    useEffect(() => {
        api.get(`/api/business/industries/${industryKey}/labels`)
            .then(({ data: d }) => { setState(d); setValues(d.values); setOpen({ [d.groups[0]?.title]: true }); setAi((a) => ({ ...a, industry: d.name })); })
            .catch((e) => flash("err", msgOf(e, "Could not load wording")));
        loadCats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [industryKey]);

    if (!state) return <section className={card}><Loader2 className="mx-auto animate-spin text-[#8a6d53]" /></section>;

    const prompt = buildPrompt({ industryName: ai.industry, groups: state.groups, details: ai.details });

    const copyPrompt = async () => {
        try { await navigator.clipboard.writeText(prompt); }
        catch { const t = document.getElementById("ai-prompt-box"); t?.select(); document.execCommand?.("copy"); }
        setAi((a) => ({ ...a, copied: true })); setTimeout(() => setAi((a) => ({ ...a, copied: false })), 2500);
    };

    const fillFromReply = () => {
        const r = parseReply(ai.reply, state.groups);
        if (!r.filled && !r.categories.length) { flash("err", "Nothing readable found. Paste the AI reply (lines like  name: My Shop)."); return; }
        setValues((v) => ({ ...v, ...r.values }));
        setPendingCats(r.categories);
        setOpen(Object.fromEntries(state.groups.map((g) => [g.title, true])));
        setAi((a) => ({ ...a, report: r }));
        flash("ok", `Filled ${r.filled} of ${r.total} fields${r.categories.length ? ` and found ${r.categories.length} categories` : ""}. Check the preview, then Save.`);
    };

    const save = async () => {
        setBusy(true);
        try {
            const { data: d } = await api.put(`/api/business/industries/${industryKey}/labels`, { labels: values });
            setState(d); setValues(d.values);
            let msg = "Wording saved";
            if (pendingCats.length) {
                const { data: imp } = await api.post("/api/business/categories/import", { industry: industryKey, categories: pendingCats });
                msg += ` · ${imp.added} categor${imp.added === 1 ? "y" : "ies"} added`;
                setPendingCats([]); setAi((a) => ({ ...a, report: null, reply: "" }));
                await loadCats(); onCategoriesChanged?.();
            }
            if (isActive) setNeedsReload(true);
            flash("ok", msg);
        } catch (e) { flash("err", msgOf(e, "Could not save")); }
        finally { setBusy(false); }
    };
    const reset = async () => {
        if (!confirm("Reset all wording of this industry back to the template?")) return;
        setBusy(true);
        try {
            const { data: d } = await api.post(`/api/business/industries/${industryKey}/labels/reset`);
            setState(d); setValues(d.values); setPendingCats([]);
            if (isActive) setNeedsReload(true);
            flash("ok", "Wording reset");
        } catch (e) { flash("err", msgOf(e, "Could not reset")); }
        finally { setBusy(false); }
    };

    const previewCats = [...cats, ...pendingCats.filter((p) => !cats.some((c) => c.name.toLowerCase() === p.name.toLowerCase()))];
    const report = ai.report;

    return (
        <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Wand2 size={18} className="text-[#7d3f24]" />
                    <h3 className="serif text-xl font-semibold">Wording: {state.name}</h3>
                    {isActive && <span className="rounded-full bg-[#d6efdc] px-2.5 py-1 text-[10px] font-bold text-[#1d7a3e]">Default</span>}
                </div>
                <div className="flex gap-2">
                    <div className="flex rounded-full border border-[#ded0bc] p-0.5 lg:hidden">
                        <button onClick={() => setView("form")} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === "form" ? "bg-[#24170f] text-white" : ""}`}><FileText size={12} /> Edit</button>
                        <button onClick={() => setView("preview")} className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${view === "preview" ? "bg-[#24170f] text-white" : ""}`}><Eye size={12} /> Preview</button>
                    </div>
                    <button onClick={reset} disabled={busy || !state.customised.length} className={btnLight}><RotateCcw size={13} /> Reset to template</button>
                </div>
            </div>
            {!isActive && <p className="mt-2 rounded-lg bg-[#fdf3d6] px-3 py-2 text-xs text-[#8a6d1c]">This industry is not active yet. You can prepare its wording now and switch to it above.</p>}

            <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
                {/* ------------ form ------------ */}
                <div className={`min-w-0 space-y-3 ${view === "preview" ? "hidden lg:block" : ""}`}>
                    {/* AI helper */}
                    <div className="rounded-xl border border-[#f1cf8a] bg-[#fdf9ef]">
                        <button type="button" onClick={() => setAi({ ...ai, open: !ai.open })} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[#7d3f24]">
                            <span className="flex items-center gap-2"><Sparkles size={15} /> Fill with AI (paste a ready-made answer)</span>
                            <ChevronDown size={16} className={`transition ${ai.open ? "rotate-180" : ""}`} />
                        </button>
                        {ai.open && (
                            <div className="space-y-3 border-t border-[#f1e3bd] p-4 text-xs text-[#5b4636]">
                                <ol className="list-decimal space-y-1 pl-4 text-[#715e4e]">
                                    <li>Type the industry below and press <strong>Copy AI prompt</strong>.</li>
                                    <li>Paste it into any AI (ChatGPT, Claude, Gemini…).</li>
                                    <li>Paste the AI's answer in the box and press <strong>Fill fields</strong>. Check the preview, then <strong>Save</strong>.</li>
                                </ol>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <label className="grid gap-1 font-semibold">Industry / business type
                                        <input className={input} value={ai.industry} onChange={(e) => setAi({ ...ai, industry: e.target.value })} placeholder="e.g. Food court" /></label>
                                    <label className="grid gap-1 font-semibold">Extra details (optional)
                                        <input className={input} value={ai.details} onChange={(e) => setAi({ ...ai, details: e.target.value })} placeholder="e.g. 8 kitchens, family friendly, Hyderabad" /></label>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button type="button" onClick={copyPrompt} className={btnDark}><Copy size={14} /> {ai.copied ? "Copied ✓" : "Copy AI prompt"}</button>
                                    <span className="text-[11px] text-[#8a6d53]">{prompt.length.toLocaleString()} characters</span>
                                </div>
                                <details className="rounded-lg bg-white p-2">
                                    <summary className="cursor-pointer font-semibold">Show the prompt</summary>
                                    <textarea id="ai-prompt-box" readOnly value={prompt} rows={8} className={`${input} mt-2 font-mono text-[11px]`} onFocus={(e) => e.target.select()} />
                                </details>
                                <label className="grid gap-1 font-semibold">Paste the AI's answer here
                                    <textarea rows={7} className={`${input} font-mono text-[11px]`} value={ai.reply}
                                        onChange={(e) => setAi({ ...ai, reply: e.target.value })}
                                        placeholder={"name: Spice Street Food Court\ntagline: Many kitchens. One table.\nitem: dish\n…\ncategory: Starters | Starters | Small bites to begin. | Light & shared"} /></label>
                                <button type="button" onClick={fillFromReply} disabled={!ai.reply.trim()} className={btnDark}><Wand2 size={14} /> Fill fields</button>

                                {report && (
                                    <div className="space-y-1 rounded-lg bg-white p-3">
                                        <div className="font-semibold text-[#1d7a3e]">✓ Filled {report.filled} of {report.total} fields · {report.categories.length} categories found (added when you Save)</div>
                                        {report.missing.length > 0 && <div className="text-[#8a6d1c]">Not in the answer (kept as they were): {report.missing.join(", ")}</div>}
                                        {report.unknown.length > 0 && <div className="text-[#8c392d]">Ignored lines: {report.unknown.join(" · ")}</div>}
                                        {report.tooLong.length > 0 && <div className="text-[#8c392d]">Very long values (check): {report.tooLong.join(", ")}</div>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {state.groups.map((g) => (
                        <div key={g.title} className="rounded-xl border border-[#eadfce]">
                            <button type="button" onClick={() => setOpen({ ...open, [g.title]: !open[g.title] })}
                                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold">
                                {g.title}<ChevronDown size={16} className={`transition ${open[g.title] ? "rotate-180" : ""}`} />
                            </button>
                            {open[g.title] && (
                                <div className="grid gap-3 border-t border-[#f0e6d6] p-4 sm:grid-cols-2">
                                    {g.fields.map((f) => (
                                        <label key={f.key} className={`grid gap-1 text-xs font-semibold text-[#5b4636] ${f.type !== "text" ? "sm:col-span-2" : ""}`}>
                                            <span className="flex items-center gap-1.5">{f.label}{state.customised.includes(f.key) && <span className="h-1.5 w-1.5 rounded-full bg-[#7d3f24]" title="Customised" />}</span>
                                            {f.type === "text"
                                                ? <input className={input} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                                                : <textarea rows={f.type === "list" ? 4 : 3} className={`${input} resize-y`} value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />}
                                            {f.hint && <span className="text-[10px] font-normal text-[#9a846f]">{f.hint}</span>}
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {pendingCats.length > 0 && (
                        <div className="rounded-xl border border-[#c8e6d2] bg-[#f3fbf6] p-3 text-xs">
                            <div className="mb-1.5 flex items-center justify-between font-semibold text-[#1d7a3e]">
                                <span>{pendingCats.length} categories will be added when you Save</span>
                                <button type="button" onClick={() => setPendingCats([])} className="text-[#8c392d] underline">Discard</button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">{pendingCats.map((c) => <span key={c.name} className="rounded-full bg-white px-2.5 py-1 font-medium text-[#3d5c47]">{c.name}</span>)}</div>
                        </div>
                    )}

                    <div><button onClick={save} disabled={busy} className={btnDark}>{busy && <Loader2 size={14} className="animate-spin" />} Save wording{pendingCats.length ? ` + ${pendingCats.length} categories` : ""}</button></div>
                </div>

                {/* ------------ live preview ------------ */}
                <div className={`min-w-0 ${view === "form" ? "hidden lg:block" : ""}`}>
                    <div className="lg:sticky lg:top-4">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#5b4636]">
                            <span className="flex items-center gap-1.5"><Eye size={13} /> Live preview</span>
                            <span className="font-normal text-[#9a846f]">updates as you type · not saved yet</span>
                        </div>
                        <WordingPreview v={values} categories={previewCats} />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ categories */
function CategoriesPanel({ flash, industryKey, industryName, isActive }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);       // { id | null, name, shortName, description, accent }
    const [deleting, setDeleting] = useState(null);     // category being deleted
    const [moveTo, setMoveTo] = useState("");
    const [busy, setBusy] = useState(false);

    // only the ACTIVE industry's categories are what the admin forms use
    const apply = (data) => { setList(data); if (isActive) syncCategories(data); };
    const load = () => api.get("/api/business/categories", { params: { industry: industryKey } }).then(({ data }) => apply(data))
        .catch((e) => flash("err", msgOf(e, "Could not load categories"))).finally(() => setLoading(false));
    useEffect(() => { load(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

    const saveCat = async (e) => {
        e.preventDefault(); setBusy(true);
        try {
            if (editing.id) await api.patch(`/api/business/categories/${editing.id}`, editing);
            else await api.post("/api/business/categories", { ...editing, industry: industryKey });
            setEditing(null); await load(); flash("ok", "Category saved");
        } catch (er) { flash("err", msgOf(er, "Could not save")); }
        finally { setBusy(false); }
    };
    const move = async (idx, dir) => {
        const next = [...list]; const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        apply(next);
        try { await api.put("/api/business/categories/order", { ids: next.map((c) => c.id) }); }
        catch (er) { flash("err", msgOf(er, "Could not reorder")); load(); }
    };
    const confirmDelete = async () => {
        setBusy(true);
        try {
            await api.delete(`/api/business/categories/${deleting.id}`, { params: deleting.designCount ? { moveTo } : {} });
            setDeleting(null); setMoveTo(""); await load(); flash("ok", "Category deleted");
        } catch (er) { flash("err", msgOf(er, "Could not delete")); }
        finally { setBusy(false); }
    };
    const starter = async () => {
        setBusy(true);
        try { const { data } = await api.post("/api/business/categories/starter", null, { params: { industry: industryKey } }); apply(data.categories); flash("ok", data.added ? `${data.added} starter categories added` : "All starter categories are already there"); }
        catch (er) { flash("err", msgOf(er, "Could not add")); }
        finally { setBusy(false); }
    };

    return (
        <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Tag size={18} className="text-[#7d3f24]" /><h3 className="serif text-xl font-semibold">Categories: {industryName}</h3>{isActive && <span className="rounded-full bg-[#d6efdc] px-2.5 py-1 text-[10px] font-bold text-[#1d7a3e]">Default</span>}</div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={starter} disabled={busy} className={btnLight}><Wand2 size={13} /> Add starter categories</button>
                    <button onClick={() => setEditing({ id: null, name: "", shortName: "", description: "", accent: "" })} className={btnDark}><Plus size={14} /> New category</button>
                </div>
            </div>
            <p className="mt-1 text-xs text-[#715e4e]">
                Each industry has its own categories. {isActive
                    ? <>These are what customers see on the home page and what you pick when adding {B.items}. Use the arrows to change the order.</>
                    : <>This industry is not active, so customers don't see these yet. They go live when you switch to it above.</>}
            </p>

            {loading ? <div className="py-8 text-center"><Loader2 className="mx-auto animate-spin text-[#8a6d53]" /></div> : (
                <ul className="mt-4 divide-y divide-[#f0e6d6] overflow-hidden rounded-xl border border-[#eadfce]">
                    {list.length === 0 && <li className="p-6 text-center text-sm text-[#8a6d53]">No categories yet. Add one, or use the starter button.</li>}
                    {list.map((c, i) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 bg-white p-3">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{c.name}</div>
                                <div className="truncate text-[11px] text-[#8a6d53]">{c.designCount} {c.designCount === 1 ? B.item : B.items}{c.description ? ` · ${c.description}` : ""}</div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-full p-2 hover:bg-[#f4eadc] disabled:opacity-30" title="Move up"><ArrowUp size={14} /></button>
                                <button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="rounded-full p-2 hover:bg-[#f4eadc] disabled:opacity-30" title="Move down"><ArrowDown size={14} /></button>
                                <button onClick={() => setEditing({ ...c })} className={btnLight}><Pencil size={12} /> Edit</button>
                                <button onClick={() => { setDeleting(c); setMoveTo(""); }} className="rounded-full border border-[#e6c4be] p-2 text-[#9b3b2b] hover:bg-[#f7e9e6]" title="Delete"><Trash2 size={13} /></button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {editing && (
                <Modal onClose={() => setEditing(null)}>
                    <form onSubmit={saveCat} className="space-y-3">
                        <h4 className="serif text-xl font-semibold">{editing.id ? "Edit category" : "New category"}</h4>
                        <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Name *<input required autoFocus className={input} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
                        <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Short name (filter button)<input className={input} value={editing.shortName} onChange={(e) => setEditing({ ...editing, shortName: e.target.value })} /></label>
                        <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Description<textarea rows={2} className={`${input} resize-none`} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
                        <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Tag line (e.g. Sharp &amp; clean)<input className={input} value={editing.accent} onChange={(e) => setEditing({ ...editing, accent: e.target.value })} /></label>
                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={() => setEditing(null)} className={`${btnLight} flex-1 py-3`}>Cancel</button>
                            <button disabled={busy} className={`${btnDark} flex-1`}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save</button>
                        </div>
                    </form>
                </Modal>
            )}

            {deleting && (
                <Modal onClose={() => setDeleting(null)}>
                    <div className="space-y-3">
                        <h4 className="serif text-xl font-semibold">Delete “{deleting.name}”?</h4>
                        {deleting.designCount > 0 ? (
                            <>
                                <p className="text-sm text-[#715e4e]">{deleting.designCount} {deleting.designCount === 1 ? B.item : B.items} use this category. Choose where to move them:</p>
                                <select className={input} value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                                    <option value="">Select a category…</option>
                                    {list.filter((c) => c.id !== deleting.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </>
                        ) : <p className="text-sm text-[#715e4e]">No {B.items} use it. It will simply be removed.</p>}
                        <div className="flex gap-2 pt-1">
                            <button onClick={() => setDeleting(null)} className={`${btnLight} flex-1 py-3`}>Cancel</button>
                            <button onClick={confirmDelete} disabled={busy || (deleting.designCount > 0 && !moveTo)}
                                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#9b3b2b] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                                {busy && <Loader2 size={14} className="animate-spin" />} Delete
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </section>
    );
}

function Modal({ children, onClose }) {
    return (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-[#20140e]/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
            <div onMouseDown={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">{children}</div>
        </div>
    );
}

/* ------------------------------------------------------------------ public address */
function AddressPanel({ biz, reload, flash }) {
    const [slug, setSlug] = useState(biz?.slug || "");
    const [published, setPublished] = useState(Boolean(biz?.published));
    const [qr, setQr] = useState(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    if (!biz) return null;

    const origin = window.location.origin;
    const url = `${origin}/${slug}`;
    const dirty = slug !== biz.slug || published !== Boolean(biz.published);

    const save = async () => {
        setBusy(true);
        try {
            await api.put(`/api/business/industries/${biz.key}/address`, { slug, published });
            await reload(); setQr(null);
            flash("ok", published ? "Saved - this business is open for customers" : "Saved - this business is hidden from customers");
        } catch (e) { flash("err", msgOf(e, "Could not save the address")); }
        finally { setBusy(false); }
    };
    const copy = async () => {
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
    };
    const showQr = async () => {
        try { const { data } = await api.get(`/api/business/industries/${biz.key}/qr`); setQr(data.qr); }
        catch (e) { flash("err", msgOf(e, "Could not make the QR code")); }
    };

    return (
        <section className={card}>
            <div className="flex items-center gap-2"><Globe size={18} className="text-[#7d3f24]" /><h3 className="serif text-xl font-semibold">Public address: {biz.name}</h3></div>
            <p className="mt-1 text-xs text-[#715e4e]">Customers open this business at its own link. A hidden business is only visible to staff (so you can set it up first).</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="grid gap-1 text-xs font-semibold text-[#5b4636]">Address
                    <div className="flex items-center rounded-xl border border-[#ddcdb8] bg-white focus-within:ring-2 focus-within:ring-[#b07a4f]">
                        <span className="pl-3 text-sm text-[#a38974]">{origin}/</span>
                        <input className="w-full bg-transparent p-3 text-sm outline-none" value={slug} spellCheck={false}
                            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="hair-beauty" />
                    </div>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#eadfce] bg-[#faf5ed] px-4 py-3 text-sm font-semibold">
                    <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-[#1d7a3e]" />
                    Open for customers
                </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <button onClick={save} disabled={busy || !dirty} className={btnDark}>{busy && <Loader2 size={14} className="animate-spin" />} Save address</button>
                <button onClick={copy} className={btnLight}><Copy size={13} /> {copied ? "Copied ✓" : "Copy link"}</button>
                <a href={`/${biz.slug}`} target="_blank" rel="noopener noreferrer" className={btnLight}><ExternalLink size={13} /> Open</a>
                <button onClick={showQr} className={btnLight}>QR code</button>
            </div>
            {qr && <div className="mt-4 inline-block rounded-2xl border border-[#eadfce] bg-white p-3 text-center"><img src={qr} alt="QR code" className="h-44 w-44" /><div className="mt-1 break-all text-[10px] text-[#8a6d53]">{origin}/{biz.slug}</div></div>}
        </section>
    );
}
