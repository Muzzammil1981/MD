import { useEffect, useState } from "react";
import {
    Plus, X, Loader2, ShieldCheck, KeyRound, Trash2, Power, UserCog, AlertCircle, CheckCircle2, Briefcase,
} from "lucide-react";
import { api } from "../lib/api";

/* SuperAdmin only: create Admin accounts, enable/disable them, reset passwords, delete. */
export default function AdminsManager({ currentUser }) {
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ username: "", fullName: "", email: "", password: "", industries: [] });
    const [allIndustries, setAllIndustries] = useState([]);   // every industry the SuperAdmin can assign
    const [indTarget, setIndTarget] = useState(null);         // admin whose industries are being edited
    const [indPick, setIndPick] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [pwTarget, setPwTarget] = useState(null);     // admin whose password is being reset
    const [newPw, setNewPw] = useState("");
    const [myPw, setMyPw] = useState({ current: "", next: "" });
    const [myPwBusy, setMyPwBusy] = useState(false);

    const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(""), 3500); };

    const load = async () => {
        try {
            const { data } = await api.get("/api/admins");
            setAdmins(data);
        } catch (err) {
            setError(err.response?.data?.message || "Could not load admins");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { load(); }, []);
    useEffect(() => {
        api.get("/api/business/industries").then(({ data }) => setAllIndustries(data.industries)).catch(() => { });
    }, []);

    const toggleKey = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

    const saveIndustries = async (e) => {
        e.preventDefault();
        if (!indPick.length) { setError("Choose at least one industry"); return; }
        setBusy(true); setError("");
        try {
            await api.put(`/api/admins/${indTarget.id}/industries`, { industries: indPick });
            flash(`Industries updated for ${indTarget.username}`);
            setIndTarget(null); load();
        } catch (err) { setError(err.response?.data?.message || "Could not update industries"); }
        finally { setBusy(false); }
    };

    const create = async (e) => {
        e.preventDefault();
        if (!form.industries.length) { setError("Choose at least one industry for this admin"); return; }
        setBusy(true); setError("");
        try {
            await api.post("/api/admins", form);
            setForm({ username: "", fullName: "", email: "", password: "", industries: [] });
            setShowForm(false);
            flash("Admin created ✓");
            load();
        } catch (err) {
            setError(err.response?.data?.message || "Could not create admin");
        } finally { setBusy(false); }
    };

    const toggleActive = async (a) => {
        setError("");
        try {
            await api.patch(`/api/admins/${a.id}`, { active: !a.active });
            flash(a.active ? `${a.username} disabled` : `${a.username} enabled`);
            load();
        } catch (err) { setError(err.response?.data?.message || "Update failed"); }
    };

    const remove = async (a) => {
        if (!confirm(`Delete admin “${a.username}”? This cannot be undone.`)) return;
        setError("");
        try {
            await api.delete(`/api/admins/${a.id}`);
            flash("Admin deleted");
            load();
        } catch (err) { setError(err.response?.data?.message || "Delete failed"); }
    };

    const resetPassword = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            await api.post(`/api/admins/${pwTarget.id}/reset-password`, { newPassword: newPw });
            flash(`Password reset for ${pwTarget.username}`);
            setPwTarget(null); setNewPw("");
        } catch (err) {
            setError(err.response?.data?.message || "Reset failed");
        } finally { setBusy(false); }
    };

    const changeMyPassword = async (e) => {
        e.preventDefault();
        setMyPwBusy(true); setError("");
        try {
            await api.post("/api/users/change-password", {
                currentPassword: myPw.current, newPassword: myPw.next,
            });
            setMyPw({ current: "", next: "" });
            flash("Your password was changed ✓");
        } catch (err) {
            setError(err.response?.data?.message || "Could not change password");
        } finally { setMyPwBusy(false); }
    };

    const input = "w-full rounded-xl border border-[#ddcdb8] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]";

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="serif text-2xl font-semibold">Admin accounts</h2>
                    <p className="text-sm text-[#715e4e]">
                        Admins can manage designs, events, orders, ads and reports. Only you (SuperAdmin) can create or remove admins.
                    </p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setError(""); }}
                    className="flex items-center gap-2 rounded-full bg-[#24170f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#382419]"
                >
                    {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Cancel" : "New admin"}
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
            )}
            {notice && (
                <div className="flex items-center gap-2 rounded-xl bg-[#d6efdc] px-4 py-3 text-sm font-semibold text-[#1d7a3e]">
                    <CheckCircle2 size={16} /> {notice}
                </div>
            )}

            {showForm && (
                <form onSubmit={create} className="grid gap-4 rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                        Username *
                        <input required className={input} value={form.username} autoCapitalize="none"
                            onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. priya" />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                        Full name
                        <input className={input} value={form.fullName}
                            onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                        Email (optional)
                        <input type="email" className={input} value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                        Password * (min 6 characters)
                        <input required type="password" minLength={6} className={input} value={form.password}
                            autoComplete="new-password"
                            onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </label>
                    <div className="sm:col-span-2">
                        <div className="text-xs font-semibold text-[#5b4636]">Industries this admin can work in *</div>
                        <p className="mt-0.5 text-[11px] font-normal text-[#8a6d53]">They will only get the orders, reviews, reports and catalogue of the industries you tick.</p>
                        <IndustryChecks all={allIndustries} picked={form.industries} onToggle={(k) => setForm({ ...form, industries: toggleKey(form.industries, k) })} />
                    </div>
                    <div className="sm:col-span-2">
                        <button disabled={busy} className="flex items-center gap-2 rounded-full bg-[#1d7a3e] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
                            {busy && <Loader2 size={15} className="animate-spin" />} Create admin
                        </button>
                    </div>
                </form>
            )}

            <div className="overflow-hidden rounded-2xl border border-[#eadfce] bg-white shadow-sm">
                {loading ? (
                    <div className="p-10 text-center text-[#8a6d53]"><Loader2 className="mx-auto animate-spin" /></div>
                ) : admins.length === 0 ? (
                    <div className="p-10 text-center text-sm text-[#8a6d53]">
                        No admins yet. Click <strong>New admin</strong> to create the first one.
                    </div>
                ) : (
                    <ul className="divide-y divide-[#f0e6d6]">
                        {admins.map((a) => (
                            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f1cf8a]/40 text-[#7d3f24]">
                                        <UserCog size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold">{a.username}</span>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${a.active ? "bg-[#d6efdc] text-[#1d7a3e]" : "bg-[#f3e0dc] text-[#9b3b2b]"}`}>
                                                {a.active ? "Active" : "Disabled"}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {(a.industries || []).length === 0
                                                ? <span className="rounded-full bg-[#f8e4df] px-2 py-0.5 text-[10px] font-bold text-[#8c392d]">No industry assigned</span>
                                                : a.industries.map((i) => <span key={i.key} className="rounded-full bg-[#f4eadc] px-2 py-0.5 text-[10px] font-bold text-[#7d3f24]">{i.name}</span>)}
                                        </div>
                                        <div className="truncate text-xs text-[#8a6d53]">
                                            {[a.fullName, a.email].filter(Boolean).join(" · ") || "-"}
                                            {a.lastLogin ? ` · last login ${new Date(a.lastLogin).toLocaleString()}` : " · never logged in"}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button onClick={() => { setIndTarget(a); setIndPick((a.industries || []).map((i) => i.key)); setError(""); }}
                                        className="flex items-center gap-1.5 rounded-full border border-[#ded0bc] px-3 py-2 text-xs font-semibold hover:bg-[#f4eadc]">
                                        <Briefcase size={13} /> Industries
                                    </button>
                                    <button onClick={() => { setPwTarget(a); setNewPw(""); setError(""); }}
                                        className="flex items-center gap-1.5 rounded-full border border-[#ded0bc] px-3 py-2 text-xs font-semibold hover:bg-[#f4eadc]">
                                        <KeyRound size={13} /> Reset password
                                    </button>
                                    <button onClick={() => toggleActive(a)}
                                        className="flex items-center gap-1.5 rounded-full border border-[#ded0bc] px-3 py-2 text-xs font-semibold hover:bg-[#f4eadc]">
                                        <Power size={13} /> {a.active ? "Disable" : "Enable"}
                                    </button>
                                    <button onClick={() => remove(a)}
                                        className="flex items-center gap-1.5 rounded-full border border-[#e6c4be] px-3 py-2 text-xs font-semibold text-[#9b3b2b] hover:bg-[#f7e9e6]">
                                        <Trash2 size={13} /> Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* My own password */}
            <form onSubmit={changeMyPassword} className="grid gap-4 rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="flex items-center gap-2 text-sm font-semibold sm:col-span-3">
                    <ShieldCheck size={16} className="text-[#7d3f24]" /> Change my SuperAdmin password ({currentUser.username})
                </div>
                <input required type="password" placeholder="Current password" className={input} value={myPw.current}
                    autoComplete="current-password" onChange={(e) => setMyPw({ ...myPw, current: e.target.value })} />
                <input required type="password" minLength={6} placeholder="New password" className={input} value={myPw.next}
                    autoComplete="new-password" onChange={(e) => setMyPw({ ...myPw, next: e.target.value })} />
                <button disabled={myPwBusy} className="flex items-center justify-center gap-2 rounded-full bg-[#24170f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                    {myPwBusy && <Loader2 size={14} className="animate-spin" />} Update
                </button>
            </form>

            {/* Industries dialog */}
            {indTarget && (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-[#20140e]/75 p-4 backdrop-blur-sm" onMouseDown={() => setIndTarget(null)}>
                    <form onSubmit={saveIndustries} onMouseDown={(e) => e.stopPropagation()}
                        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="serif text-xl font-semibold">Industries for {indTarget.username}</h3>
                        <p className="text-sm text-[#715e4e]">This admin only gets orders, reviews, reports and catalogue of the industries ticked.</p>
                        <IndustryChecks all={allIndustries} picked={indPick} onToggle={(k) => setIndPick(toggleKey(indPick, k))} />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setIndTarget(null)} className="flex-1 rounded-full border border-[#ded0bc] py-3 text-sm font-semibold">Cancel</button>
                            <button disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#24170f] py-3 text-sm font-semibold text-white disabled:opacity-60">
                                {busy && <Loader2 size={14} className="animate-spin" />} Save
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Reset-password dialog */}
            {pwTarget && (
                <div className="fixed inset-0 z-[80] grid place-items-center bg-[#20140e]/75 p-4 backdrop-blur-sm" onMouseDown={() => setPwTarget(null)}>
                    <form onSubmit={resetPassword} onMouseDown={(e) => e.stopPropagation()}
                        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
                        <h3 className="serif text-xl font-semibold">Reset password</h3>
                        <p className="text-sm text-[#715e4e]">Set a new password for <strong>{pwTarget.username}</strong>.</p>
                        <input autoFocus required type="password" minLength={6} placeholder="New password (min 6)"
                            className={input} value={newPw} autoComplete="new-password" onChange={(e) => setNewPw(e.target.value)} />
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setPwTarget(null)}
                                className="flex-1 rounded-full border border-[#ded0bc] py-3 text-sm font-semibold">Cancel</button>
                            <button disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#24170f] py-3 text-sm font-semibold text-white disabled:opacity-60">
                                {busy && <Loader2 size={14} className="animate-spin" />} Save
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

function IndustryChecks({ all, picked, onToggle }) {
    if (!all.length) return <div className="mt-2 text-xs text-[#8a6d53]">Loading industries…</div>;
    return (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {all.map((i) => {
                const on = picked.includes(i.key);
                return (
                    <button key={i.key} type="button" onClick={() => onToggle(i.key)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${on ? "border-[#24170f] bg-[#fdf7ee]" : "border-[#eadfce] bg-white hover:bg-[#faf5ed]"}`}>
                        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${on ? "border-[#24170f] bg-[#24170f] text-white" : "border-[#c9b79e]"}`}>{on && <CheckCircle2 size={11} />}</span>
                        <span className="truncate">{i.name}</span>
                    </button>
                );
            })}
        </div>
    );
}
