import { useEffect, useState } from "react";
import {
    LogOut, Image as ImageIcon, Users, Bell, Plus, X, Upload, Loader2,
    Calendar, Clock, CheckCircle2, XCircle, ShieldAlert, Play, Square,
    BarChart3, LayoutGrid, Trash2, QrCode, Search, Monitor,
    Timer, Palette, Coins, Megaphone, Edit, Star, Briefcase,
} from "lucide-react";
import { io } from "socket.io-client";
import AdminsManager from "../components/AdminsManager";
import ReviewsManager from "../components/ReviewsManager";
import ScheduleCard from "../components/ScheduleCard";
import BusinessManager from "../components/BusinessManager";
import { api, API_BASE, setIndustrySlug } from "../lib/api";
import { playNotificationSound, primeAudioOnFirstGesture } from "../lib/notify";
import AdminSettingsCard from "./AdminSettingsCard";
import ReportsPanel from "./ReportsPanel";

import AdminDesigns from "./AdminDesigns";
import { imageUrl, currency } from "../lib/format";
import SafeImage from "../components/SafeImage";
import AdvertisementsManager from "../components/AdvertisementsManager";
import { B } from "../lib/brand";


/* public address of an event's business, e.g. https://site/barber  (events open as /<business>?event=ID) */
const eventBase = (e) => `${window.location.origin}${e?.businessSlug ? `/${e.businessSlug}` : ""}`;

export default function AdminDashboard({ user, onLogout }) {
    const [toast, setToast] = useState(null);
    const [addOpen, setAddOpen] = useState(false);
    // industries this admin may work in (SuperAdmin: all) + the one selected on screen
    const [ctx, setCtx] = useState({ liveIndustry: "", industries: [] });
    const [workKey, setWorkKey] = useState("");
    useEffect(() => {
        api.get("/api/admin-context").then(({ data }) => {
            setCtx(data);
            setWorkKey((k) => k || (data.industries.find((i) => i.key === data.liveIndustry) || data.industries[0])?.key || "");
        }).catch(() => { });
    }, []);
    const workIndustry = ctx.industries.find((i) => i.key === workKey);
    // every request from this dashboard is for the business selected in "Working in" (set during render so child effects see it)
    if (workIndustry) setIndustrySlug(workIndustry.slug);
    const [designsKey, setDesignsKey] = useState(0);
    const [lightbox, setLightbox] = useState(null);
    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [actionOrder, setActionOrder] = useState(null);

    const [events, setEvents] = useState([]);
    const [eventFilter, setEventFilter] = useState("all");

    useEffect(() => { primeAudioOnFirstGesture(); }, []);
    useEffect(() => {
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("mehndi-token");
        const socket = io(API_BASE, { auth: { token } });
        socket.on("notification", (n) => {
            playNotificationSound("info");
            if (
                n.type === "new-order" ||
                n.type === "order-paid" ||
                n.type === "payment-claim" ||
                n.type === "order-update" ||
                n.type === "order-completed"
            ) {
                showToast("info", n.title);
                setTimeout(() => loadOrders(true), 300);
            } else {
                showToast("info", n.title);
            }
        });
        return () => socket.disconnect();
    }, []);

    const [tab, setTab] = useState("dashboard");

    const loadOrders = async (silent = false) => {
        if (!silent) setOrdersLoading(true);
        try {
            const { data } = await api.get(`/api/orders?t=${Date.now()}`);
            setOrders(data);
            const evRes = await api.get(`/api/events?t=${Date.now()}`);
            setEvents(Array.isArray(evRes.data) ? evRes.data : (evRes.data?.events || []));
        }
        catch { /* ignore */ }
        finally { setOrdersLoading(false); }
    };

    useEffect(() => { loadOrders(); }, []);

    const showToast = (kind, text) => { setToast({ kind, text }); setTimeout(() => setToast(null), 3500); };
    const pendingCount = orders.filter(o => o.status === "pending").length;
    const verifyCount = orders.filter(o => o.status === "awaiting-verification").length;
    const customCount = orders.filter(o => ["custom-pending", "quote-proposed"].includes(o.status)).length;
    const HIDDEN_STATUSES = ["completed", "rejected"];
    const activeOrders = orders.filter(o => !HIDDEN_STATUSES.includes(o.status));

    const eventNameMap = Object.fromEntries(events.map(e => [e.id, e.name]));

    const filteredOrders = activeOrders.filter(o => {
        if (eventFilter === "all") return true;
        if (eventFilter === "none") return !o.eventId;
        return o.eventId === eventFilter;
    });

    return (
        <div className="min-h-[100dvh] overflow-x-hidden bg-[#fbf8f2] text-[#2a1a12]">
            <header className="sticky top-0 z-30 border-b border-[#eadfce] bg-[#fbf8f2]/90 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-5 lg:px-8">
                    <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#24170f] text-[#f1cf8a] serif">{B.initial}</div>
                        <div className="min-w-0">
                            <div className="serif truncate text-sm font-bold leading-tight sm:text-base">{B.name}</div>
                            <div className="truncate text-[9px] uppercase tracking-[.18em] text-[#8a6d53] sm:text-[10px] sm:tracking-[.22em]">{user.role === "SUPERADMIN" ? "SuperAdmin" : "Admin"} · {user.username}</div>
                        </div>
                    </div>
                    <button onClick={onLogout} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ded0bc] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f4eadc] sm:gap-2 sm:px-4 sm:text-sm"><LogOut size={14} /> <span className="hidden sm:inline">Sign out</span></button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-10 lg:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="serif text-3xl font-semibold sm:text-4xl">Dashboard</h1>
                        <p className="mt-2 max-w-xl text-sm text-[#715e4e]">Manage {B.items}, events, customers and appointments.</p>
                        {ctx.industries.length > 0 && (
                            <label className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ded0bc] bg-white px-3 py-1.5 text-xs font-semibold text-[#5b4636]">
                                <Briefcase size={13} className="text-[#7d3f24]" /> Working in
                                <select value={workKey} onChange={(e) => setWorkKey(e.target.value)} className="bg-transparent font-bold outline-none">
                                    {ctx.industries.map((i) => <option key={i.key} value={i.key}>{i.name}{i.isLive ? " (live)" : ""}</option>)}
                                </select>
                            </label>
                        )}
                        {user.role === "ADMIN" && ctx.industries.length === 0 && (
                            <div className="mt-3 rounded-xl bg-[#fdf3d6] px-4 py-3 text-xs font-medium text-[#8a6d1c]">No industry is assigned to your account yet. Ask the SuperAdmin to assign one - then your orders and catalogue appear here.</div>
                        )}
                    </div>
                    <div className="inline-flex w-full rounded-full border border-[#ded0bc] bg-white p-1 sm:w-auto overflow-x-auto no-scrollbar">
                        <button onClick={() => setTab("dashboard")} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${tab === "dashboard" ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}><LayoutGrid size={14} /> Dashboard</button>
                        <button onClick={() => setTab("events")} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${tab === "events" ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}><Calendar size={14} /> Events</button>
                        {user.role === "SUPERADMIN" && (
                            <button onClick={() => setTab("business")} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${tab === "business" ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}><Briefcase size={14} /> Business</button>
                        )}
                        {user.role === "SUPERADMIN" && (
                            <button onClick={() => setTab("admins")} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${tab === "admins" ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}><ShieldAlert size={14} /> Admins</button>
                        )}
                        <button onClick={() => setTab("reviews")} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${tab === "reviews" ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}><Star size={14} /> Reviews</button>
                        <button onClick={() => setTab("reports")} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition sm:flex-none sm:px-4 sm:text-sm ${tab === "reports" ? "bg-[#24170f] text-white" : "text-[#5b4636] hover:bg-[#f4eadc]"}`}><BarChart3 size={14} /> Reports</button>
                    </div>
                </div>

                {tab === "reports" && <div className="mt-6 sm:mt-8"><ReportsPanel /></div>}
                {tab === "events" && <div className="mt-6 sm:mt-8"><EventsManager /></div>}
                {tab === "reviews" && <div className="mt-6 sm:mt-8"><ReviewsManager /></div>}
                {tab === "business" && user.role === "SUPERADMIN" && <div className="mt-6 sm:mt-8"><BusinessManager /></div>}
                {tab === "admins" && user.role === "SUPERADMIN" && <div className="mt-6 sm:mt-8"><AdminsManager currentUser={user} /></div>}

                {tab === "dashboard" && (
                    <>
                        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6">
                            <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                                <button onClick={() => setAddOpen(true)} className="rounded-2xl border border-[#eadfce] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-3xl sm:p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1cf8a]/40 text-[#7d3f24]"><ImageIcon size={18} /></div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold sm:text-base">{B.Items}</div>
                                            <div className="truncate text-[11px] text-[#8a6d53] sm:text-xs">Add & manage {B.items}</div>
                                        </div>
                                        <Plus size={16} className="shrink-0 text-[#7d3f24]" />
                                    </div>
                                </button>
                                <QuickCard icon={<Users size={18} />} title="Customers" body="Registered customer accounts" />
                                <QuickCard
                                    icon={<Bell size={18} />}
                                    title="Appointments"
                                    body={
                                        customCount > 0
                                            ? `${customCount} custom request${customCount > 1 ? "s" : ""} awaiting quote`
                                            : verifyCount > 0
                                                ? `${verifyCount} payment${verifyCount > 1 ? "s" : ""} to verify`
                                                : pendingCount > 0
                                                    ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""}`
                                                    : "No pending requests"
                                    }
                                />
                            </div>
                        </div>

                        <div className="mt-4 sm:mt-6"><AdminSettingsCard role={user.role} /></div>
                        {user.role === "SUPERADMIN" && <div className="mt-4 sm:mt-6"><ScheduleCard key={workKey} industryName={workIndustry?.name} /></div>}

                        <section className="mt-10 sm:mt-12">
                            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h2 className="serif text-xl font-semibold sm:text-2xl">Appointment requests</h2>
                                    <p className="text-xs text-[#8a6d53] sm:text-sm">{pendingCount} pending · {verifyCount} to verify · {customCount} custom · {activeOrders.length} active</p>
                                </div>
                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                    <select
                                        value={eventFilter}
                                        onChange={(e) => setEventFilter(e.target.value)}
                                        className="rounded-full border border-[#ded0bc] bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                    >
                                        <option value="all">All Events</option>
                                        <option value="none">Normal Orders</option>
                                        {events.map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                    <button onClick={() => loadOrders()} className="rounded-full border border-[#ded0bc] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#f4eadc]">Refresh</button>
                                </div>
                            </div>
                            {ordersLoading ? (
                                <div className="rounded-2xl border border-[#eadfce] bg-white p-12 text-center text-[#8a6d53]"><Loader2 className="mx-auto animate-spin" /></div>
                            ) : orders.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-[#d9c7b0] bg-white p-10 text-center text-sm text-[#8a6d53] sm:p-12">No appointment requests yet.</div>
                            ) : filteredOrders.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-[#d9c7b0] bg-white p-10 text-center text-sm text-[#8a6d53] sm:p-12">No active appointment requests match this filter.</div>
                            ) : (
                                <div className="grid gap-4">
                                    {filteredOrders.map(o => (
                                        <OrderCard
                                            key={o.id}
                                            order={o}
                                            eventName={eventNameMap[o.eventId]}
                                            onAction={setActionOrder}
                                            onRefresh={() => loadOrders(true)}
                                            onViewImage={(src, alt) => setLightbox({ src, alt })}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        <AdminDesigns key={workKey} user={user} categories={workIndustry?.categories || []} industry={workKey || undefined} refreshKey={designsKey} onAdd={() => setAddOpen(true)} onView={setLightbox} onToast={showToast} />
                    </>
                )}
            </main>

            {addOpen && <AddDesignModal categories={workIndustry?.categories || []} industryName={workIndustry?.name} onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); setDesignsKey(k => k + 1); showToast("ok", `${B.Item} saved ✓`); }} />}

            {actionOrder?.mode === "quote" && (
                <QuoteCustomOrderModal
                    order={actionOrder.order}
                    onClose={() => setActionOrder(null)}
                    onDone={() => { setActionOrder(null); loadOrders(true); showToast("ok", "Response sent to customer"); }}
                />
            )}

            {actionOrder && actionOrder.mode !== "quote" && (
                <OrderActionModal
                    order={actionOrder.order}
                    mode={actionOrder.mode}
                    onClose={() => setActionOrder(null)}
                    onDone={() => { setActionOrder(null); loadOrders(true); showToast("ok", "Order updated"); }}
                />
            )}

            {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
            {toast && <div className={`fixed left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm font-semibold shadow-xl sm:left-auto sm:right-6 sm:w-auto sm:max-w-none sm:-translate-x-0 sm:text-left ${toast.kind === "err" ? "bg-[#7d3f24] text-white" : toast.kind === "ok" ? "bg-[#1d7a3e] text-white" : "bg-[#24170f] text-[#f1cf8a]"}`} style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>{toast.text}</div>}
        </div>
    );
}

/* =========================================================
   EVENTS MANAGER COMPONENT
   ========================================================= */
function EventsManager() {
    const [events, setEvents] = useState([]);
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const [qrEvent, setQrEvent] = useState(null);
    const [previewDesign, setPreviewDesign] = useState(null);
    const [designSearch, setDesignSearch] = useState("");

    const [name, setName] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [selectedDesigns, setSelectedDesigns] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [priceOverrides, setPriceOverrides] = useState({});
    const [monitorEvent, setMonitorEvent] = useState(null);
    const [adsEvent, setAdsEvent] = useState(null);
    const [editingEvent, setEditingEvent] = useState(null);

    useEffect(() => {
        fetchEvents();
        fetchDesigns();
    }, []);

    const fetchEvents = async () => {
        try {
            const { data } = await api.get("/api/events");
            setEvents(Array.isArray(data) ? data : (data?.events || []));
        } catch (err) {
            console.error("Failed to fetch events", err);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchDesigns = async () => {
        try {
            const { data } = await api.get("/api/designs");
            setDesigns(data);
        } catch (err) { console.error(err); }
    };

    const getEventStatus = (event) => {
        const now = new Date();
        const start = new Date(event.startDate);
        const end = new Date(event.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return "closed";
        if (now < start) return "upcoming";
        if (now > end) return "closed";
        return "active";
    };

    const handleDesignToggle = (id) => {
        setSelectedDesigns(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
    };

    const handlePriceChange = (id, value) => {
        if (value === "") {
            setPriceOverrides(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } else {
            setPriceOverrides(prev => ({ ...prev, [id]: Number(value) }));
        }
    };

    const filteredDesigns = designs.filter(d =>
        d.name.toLowerCase().includes(designSearch.toLowerCase()) ||
        (d.categoryName && d.categoryName.toLowerCase().includes(designSearch.toLowerCase()))
    );

    const selectAllFiltered = () => {
        const filteredIds = filteredDesigns.map(d => d.id);
        setSelectedDesigns(prev => Array.from(new Set([...prev, ...filteredIds])));
    };

    const submitEvent = async (e) => {
        e.preventDefault();
        try {
            await api.post("/api/events", {
                name,
                startDate: new Date(startDate).toISOString(),
                endDate: new Date(endDate).toISOString(),
                designIds: selectAll ? ["all"] : selectedDesigns,
                priceOverrides
            });
            setShowForm(false);
            fetchEvents();
            setName(""); setStartDate(""); setEndDate(""); setSelectedDesigns([]); setSelectAll(false); setPriceOverrides({}); setDesignSearch("");
        } catch (err) {
            alert(err.response?.data?.message || "Failed to create event");
        }
    };

    const deleteEvent = async (id) => {
        if (!confirm("Are you sure you want to delete this event?")) return;
        try {
            await api.delete(`/api/events/${id}`);
            fetchEvents();
        } catch (err) { alert("Failed to delete event"); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="serif text-2xl font-semibold">Event Manager</h2>
                <button onClick={() => setShowForm(!showForm)} className="bg-[#24170f] text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-[#382419] transition">
                    <Plus size={16} /> {showForm ? "Cancel" : "Create Event"}
                </button>
            </div>

            {showForm && (
                <form onSubmit={submitEvent} className="bg-white p-6 rounded-2xl border border-[#eadfce] space-y-4 shadow-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm font-semibold">
                            Event Name
                            <input required value={name} onChange={e => setName(e.target.value)} className="rounded-xl border border-[#ddcdb8] p-3 font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" placeholder="e.g. Diwali Special 2026" />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="grid gap-1.5 text-sm font-semibold">
                                Start Date & Time
                                <input required type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl border border-[#ddcdb8] p-3 font-normal text-xs outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                            </label>
                            <label className="grid gap-1.5 text-sm font-semibold">
                                End Date & Time
                                <input required type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl border border-[#ddcdb8] p-3 font-normal text-xs outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                            </label>
                        </div>
                    </div>

                    <div className="border-t border-[#eadfce] pt-4">
                        <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-center sm:justify-between">
                            <h3 className="font-semibold text-sm">Select {B.Items} & Set Event Prices</h3>
                            <div className="flex items-center gap-2">
                                {designSearch && (
                                    <button type="button" onClick={selectAllFiltered} className="text-[10px] font-semibold text-[#7d3f24] bg-[#f4eadc] px-3 py-1.5 rounded-full hover:bg-[#eaddc8] transition">
                                        Select Filtered ({filteredDesigns.length})
                                    </button>
                                )}
                                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer bg-[#f4eadc] px-3 py-1.5 rounded-full">
                                    <input type="checkbox" checked={selectAll} onChange={e => setSelectAll(e.target.checked)} className="accent-[#7d3f24]" />
                                    Select All Designs
                                </label>
                            </div>
                        </div>

                        {!selectAll && (
                            <>
                                <div className="relative mb-3">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a6d53]" />
                                    <input type="text" placeholder={`Search ${B.items} by name or category...`} value={designSearch} onChange={(e) => setDesignSearch(e.target.value)} className="w-full rounded-xl border border-[#ddcdb8] bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                                </div>

                                <div className="max-h-60 overflow-y-auto border border-[#eadfce] rounded-xl p-3 space-y-2 bg-[#fbf8f2]">
                                    {filteredDesigns.length === 0 ? (
                                        <div className="text-center py-6 text-xs text-[#8a6d53]">No {B.items} found matching "{designSearch}"</div>
                                    ) : (
                                        filteredDesigns.map(d => (
                                            <div key={d.id} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-[#f0e6d8] transition">
                                                <div className="flex items-center justify-between">
                                                    <label className="flex items-center gap-3 text-xs font-semibold truncate max-w-[250px] cursor-pointer">
                                                        <input type="checkbox" checked={selectedDesigns.includes(d.id)} onChange={() => handleDesignToggle(d.id)} className="accent-[#7d3f24]" />
                                                        <span className="truncate">{d.name}</span>
                                                    </label>
                                                    <button type="button" onClick={() => setPreviewDesign(d)} className="text-[#8a6d53] hover:text-[#7d3f24] p-1.5 rounded-full hover:bg-[#f4eadc] transition" title={`View ${B.Item}`}>
                                                        <ImageIcon size={14} />
                                                    </button>
                                                </div>
                                                {selectedDesigns.includes(d.id) && (
                                                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-[#f0e6d8]">
                                                        <span className="text-[10px] text-[#8a6d53] uppercase tracking-wider">
                                                            Event Price: <span className="font-bold text-[#7d3f24]">(Current: {currency(d.price)})</span>
                                                        </span>
                                                        <input type="number" placeholder={`Leave blank for ${d.price}`} value={priceOverrides[d.id] || ""} onChange={(e) => handlePriceChange(d.id, e.target.value)} className="w-32 border border-[#ddcdb8] rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-[#b07a4f]" />
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <button type="submit" className="w-full bg-[#1d7a3e] text-white py-3.5 rounded-full font-semibold text-sm hover:bg-[#155c2d] transition shadow-md">Save Event</button>
                </form>
            )}

            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center p-8 text-[#8a6d53]"><Loader2 className="mx-auto animate-spin" /></div>
                ) : events.length === 0 ? (
                    <div className="text-center p-8 text-[#8a6d53] border border-dashed rounded-2xl bg-white">No events created yet.</div>
                ) : (
                    events.map(e => {
                        const status = getEventStatus(e);
                        const isActive = status === "active";
                        const isClosed = status === "closed";

                        const statusConfig = {
                            active: { label: "Active Now", color: "bg-[#e2f0e5] text-[#1d7a3e] border-[#1d7a3e]/30" },
                            upcoming: { label: "Upcoming", color: "bg-[#fdf3d6] text-[#8a6d1c] border-[#8a6d1c]/30" },
                            closed: { label: "Closed", color: "bg-[#f4eadc] text-[#8a6d53] border-[#8a6d53]/30" }
                        }[status];

                        return (
                            <div key={e.id} className={`bg-white p-5 rounded-2xl border ${isActive ? 'border-[#1d7a3e] shadow-[0_0_15px_rgba(29,122,62,0.15)]' : 'border-[#eadfce]'} flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 shadow-sm hover:shadow-md transition`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <div className={`font-semibold text-lg ${isClosed ? 'text-[#8a6d53]' : 'text-[#24170f]'}`}>{e.name}</div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[#8a6d53] flex flex-col sm:flex-row gap-1 sm:gap-4 mt-1.5">
                                        <span className="flex items-center gap-1"><Calendar size={12} /> Start: {new Date(e.startDate).toLocaleString()}</span>
                                        <span className="flex items-center gap-1"><Clock size={12} /> End: {new Date(e.endDate).toLocaleString()}</span>
                                    </div>
                                    <div className="text-[10px] text-[#7d3f24] font-semibold mt-2 bg-[#f4eadc] inline-block px-2 py-1 rounded-full">
                                        {e.designIds?.includes("all") ? `All ${B.Items} Included` : `${e.designIds?.length || 0} ${B.Items} Included`}
                                    </div>
                                    <div className="text-[10px] text-[#1d7a3e] font-semibold mt-2 ml-2 bg-[#e2f0e5] inline-block px-2 py-1 rounded-full">
                                        Token Counter: #{e.tokenCounter || 0}
                                    </div>
                                    {e.ownerName && (
                                        <div className="text-[10px] text-[#5b4636] font-semibold mt-2 ml-2 bg-[#f4eadc] inline-block px-2 py-1 rounded-full">
                                            Created by {e.ownerName}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                                    <button onClick={() => setEditingEvent(e)} className="text-[#7d3f24] p-2.5 sm:p-3 hover:bg-[#f4eadc] rounded-full transition" title="Edit Event Dates">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => setQrEvent(e)} className="text-[#7d3f24] p-2.5 sm:p-3 hover:bg-[#f4eadc] rounded-full transition" title="Generate QR Code">
                                        <QrCode size={18} />
                                    </button>
                                    <button onClick={() => setMonitorEvent(e)} className="text-[#1d7a3e] p-2.5 sm:p-3 hover:bg-[#e2f0e5] rounded-full transition" title="Monitor Display Link">
                                        <Monitor size={18} />
                                    </button>
                                    <button onClick={() => setAdsEvent(e)} className="text-[#7d3f24] p-2.5 sm:p-3 hover:bg-[#f4eadc] rounded-full transition" title="Manage Advertisements">
                                        <Megaphone size={18} />
                                    </button>
                                    <button onClick={() => deleteEvent(e.id)} className="text-red-500 p-2.5 sm:p-3 hover:bg-red-50 rounded-full transition" title="Delete Event">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* QR CODE MODAL */}
            {qrEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#20140e]/70 backdrop-blur-sm p-4" onMouseDown={() => setQrEvent(null)}>
                    <div onMouseDown={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="serif text-xl font-semibold text-[#24170f]">Event QR Code</h3>
                            <button onClick={() => setQrEvent(null)} className="text-[#8a6d53] hover:text-[#24170f]"><X size={20} /></button>
                        </div>
                        <p className="text-xs text-[#8a6d53] mb-4">Scan this QR code at your store to order from <strong>{qrEvent.name}</strong></p>
                        <div className="bg-white p-4 rounded-2xl border border-[#eadfce] inline-block">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${eventBase(qrEvent)}?event=${qrEvent.id}`)}`} alt="Event QR Code" className="w-48 h-48 mx-auto" />
                        </div>
                        <p className="text-[10px] text-[#8a6d53] mt-4 break-all bg-[#faf5ed] p-2 rounded-lg">{eventBase(qrEvent)}?event={qrEvent.id}</p>
                    </div>
                </div>
            )}

            {/* MONITOR LINK MODAL */}
            {monitorEvent && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#20140e]/70 backdrop-blur-sm p-4" onMouseDown={() => setMonitorEvent(null)}>
                    <div onMouseDown={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="serif text-xl font-semibold text-[#24170f]">Monitor Display</h3>
                            <button onClick={() => setMonitorEvent(null)} className="text-[#8a6d53] hover:text-[#24170f]"><X size={20} /></button>
                        </div>

                        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#e2f0e5] text-[#1d7a3e]">
                            <Monitor size={32} />
                        </div>

                        <p className="text-sm text-[#5b4636] mb-2">
                            Open this link on a <strong>TV or monitor outside your studio</strong> to show live queue status.
                        </p>
                        <p className="text-xs text-[#8a6d53] mb-6">
                            Customers will see: Now Serving, Up Next, and Recently Completed tokens for <strong>{monitorEvent.name}</strong>.
                        </p>

                        <div className="rounded-2xl bg-[#faf5ed] border border-[#eadfce] p-4 mb-4">
                            <code className="text-xs break-all text-[#7d3f24] font-mono">
                                {eventBase(monitorEvent)}/monitor?event={monitorEvent.id}
                            </code>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${eventBase(monitorEvent)}/monitor?event=${monitorEvent.id}`);
                                    alert("Monitor link copied!");
                                }}
                                className="rounded-full bg-[#f4eadc] text-[#7d3f24] py-3 text-sm font-semibold hover:bg-[#eaddc8] transition"
                            >
                                Copy Link
                            </button>
                            <a
                                href={`${monitorEvent.businessSlug ? `/${monitorEvent.businessSlug}` : ""}/monitor?event=${monitorEvent.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full bg-[#1d7a3e] text-white py-3 text-sm font-semibold hover:bg-[#155c2d] transition text-center"
                            >
                                Open Preview
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* ADVERTISEMENTS MANAGER MODAL */}
            {adsEvent && (
                <AdvertisementsManager
                    event={adsEvent}
                    onClose={() => setAdsEvent(null)}
                />
            )}

            {/* EDIT EVENT MODAL */}
            {editingEvent && (
                <EditEventModal
                    event={editingEvent}
                    onClose={() => setEditingEvent(null)}
                    onSaved={() => { setEditingEvent(null); fetchEvents(); }}
                />
            )}

            {/* DESIGN IMAGE PREVIEW MODAL */}
            {previewDesign && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#20140e]/80 backdrop-blur-sm p-4" onMouseDown={() => setPreviewDesign(null)}>
                    <div onMouseDown={e => e.stopPropagation()} className="bg-white rounded-3xl p-4 max-w-lg w-full shadow-2xl relative">
                        <button onClick={() => setPreviewDesign(null)} className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80">
                            <X size={16} />
                        </button>
                        <div className="flex items-center justify-center bg-[#eadcc9] rounded-2xl p-2 min-h-[300px]">
                            <SafeImage src={imageUrl(previewDesign.image)} alt={previewDesign.name} className="w-full h-auto max-h-[60vh] object-contain rounded-xl" />
                        </div>
                        <div className="mt-4 text-center">
                            <div className="font-semibold text-lg text-[#24170f]">{previewDesign.name}</div>
                            <div className="text-sm text-[#8a6d53]">Current Price: {currency(previewDesign.price)}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* =========================================================
   EDIT EVENT MODAL
   ========================================================= */
/* =========================================================
   EDIT EVENT MODAL
   ========================================================= */
function EditEventModal({ event, onClose, onSaved }) {
    const formatForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "";
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    };

    const [form, setForm] = useState({
        name: event.name || "",
        startDate: formatForInput(event.startDate),
        endDate: formatForInput(event.endDate),
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    // Real-time validation: Is the end date/time before or equal to the start?
    const isDateInvalid = () => {
        if (!form.startDate || !form.endDate) return false;
        const start = new Date(form.startDate);
        const end = new Date(form.endDate);
        return end <= start;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (isDateInvalid()) {
            setError("End date and time must be after the start date and time. If the event ends the next day, please change the End Date as well.");
            return;
        }

        setBusy(true);
        setError("");

        try {
            const payload = {
                name: form.name,
                startDate: new Date(form.startDate).toISOString(),
                endDate: new Date(form.endDate).toISOString(),
            };

            await api.patch(`/api/events/${event.id}`, payload);
            onSaved();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update event");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-[#20140e]/70 backdrop-blur-sm p-4" onMouseDown={onClose}>
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onMouseDown={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-5">
                    <h2 className="serif text-xl font-bold text-[#24170f]">Edit Event Details</h2>
                    <button onClick={onClose} className="text-[#8a6d53] hover:text-[#24170f]">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <label className="grid gap-1.5 text-sm font-semibold text-[#5b4636]">
                        Event Name
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="rounded-xl border border-[#ddcdb8] px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]"
                        />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1.5 text-sm font-semibold text-[#5b4636]">
                            Start Date & Time
                            <input
                                type="datetime-local"
                                required
                                value={form.startDate}
                                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                                className="rounded-xl border border-[#ddcdb8] px-3 py-2.5 text-xs font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]"
                            />
                        </label>
                        <label className="grid gap-1.5 text-sm font-semibold text-[#5b4636]">
                            End Date & Time
                            <input
                                type="datetime-local"
                                required
                                value={form.endDate}
                                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                                className="rounded-xl border border-[#ddcdb8] px-3 py-2.5 text-xs font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]"
                            />
                        </label>
                    </div>

                    {/* Frontend warning for invalid dates */}
                    {isDateInvalid() && (
                        <div className="rounded-xl bg-[#fdf3d6] px-4 py-3 text-xs text-[#8a6d1c]">
                            ⚠️ <strong>Invalid time range:</strong> The end time is before the start time. If the event ends the next day, please change the <strong>End Date</strong> to the next day.
                        </div>
                    )}

                    {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 rounded-full border border-[#ded0bc] bg-white py-3 text-sm font-semibold">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={busy || isDateInvalid()}
                            className="flex-1 rounded-full bg-[#24170f] py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {busy ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ---------- Quick card ---------- */
function QuickCard({ icon, title, body }) {
    return (
        <div className="rounded-2xl border border-[#eadfce] bg-white p-4 sm:rounded-3xl sm:p-5">
            <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#f1cf8a]/40 text-[#7d3f24]">{icon}</div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold sm:text-base">{title}</div>
                    <div className="truncate text-[11px] text-[#8a6d53] sm:text-xs">{body}</div>
                </div>
            </div>
        </div>
    );
}

/* ---------- Order card ---------- */
function OrderCard({ order, eventName, onAction, onRefresh, onViewImage }) {
    const STATUS = {
        pending: { cls: "bg-[#f4eadc] text-[#8a6d53]", label: "Pending" },
        approved: { cls: "bg-[#e2f0e5] text-[#1d7a3e]", label: "Awaiting payment" },
        "awaiting-verification": { cls: "bg-[#fdf3d6] text-[#8a6d1c]", label: "Verify payment ⏳" },
        rejected: { cls: "bg-[#f8e4df] text-[#8c392d]", label: "Rejected" },
        paid: { cls: "bg-[#e2f0e5] text-[#1d7a3e]", label: "Paid" },
        "in-progress": { cls: "bg-[#fdf3d6] text-[#8a6d1c]", label: "In progress 🎨" },
        completed: { cls: "bg-[#e2f0e5] text-[#1d7a3e]", label: "Completed ✓" },
        "custom-pending": { cls: "bg-[#fdf9ef] text-[#7d3f24] border border-[#f1cf8a]", label: "Custom · Awaiting quote" },
        "quote-proposed": { cls: "bg-[#fdf3d6] text-[#8a6d1c]", label: "Counter-offer sent" },
    }[order.status] || { cls: "bg-[#f4eadc] text-[#8a6d53]", label: order.status };

    const d = order.proposedDate || order.requestedDate;
    const t = order.proposedTime || order.requestedTime;
    const [verifyBusy, setVerifyBusy] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [err, setErr] = useState("");

    const confirmPayment = async () => {
        const label = order.paymentMethod === "cash" ? "cash" : order.paymentMethod === "card" ? "card" : "UPI";
        const amountDue = Number(order.balanceDue) > 0 ? Number(order.balanceDue) : Number(order.total);
        if (!confirm(`Confirm you received ${currency(amountDue)} via ${label}?`)) return;
        setVerifyBusy(true); setErr("");
        try { await api.post(`/api/orders/${order.id}/confirm-payment`, {}); onRefresh?.(); }
        catch (e) { setErr(e.response?.data?.message || "Failed"); }
        finally { setVerifyBusy(false); }
    };

    const submitReject = async () => {
        setVerifyBusy(true); setErr("");
        try { await api.post(`/api/orders/${order.id}/reject-payment`, { reason: rejectReason }); setRejectOpen(false); onRefresh?.(); }
        catch (e) { setErr(e.response?.data?.message || "Failed"); }
        finally { setVerifyBusy(false); }
    };

    const acknowledgeRefund = async () => {
        const amount = Number(order.refundDue) || 0;
        if (!confirm(`Mark ${currency(amount)} refund as given to ${order.username}?`)) return;
        setVerifyBusy(true); setErr("");
        try {
            await api.post(`/api/orders/${order.id}/acknowledge-refund`, {});
            onRefresh?.();
        } catch (e) {
            setErr(e.response?.data?.message || "Failed");
        } finally {
            setVerifyBusy(false);
        }
    };

    const startWork = async () => {
        setVerifyBusy(true); setErr("");
        try { await api.post(`/api/orders/${order.id}/start-work`); onRefresh?.(); }
        catch (e) { setErr(e.response?.data?.message || "Failed"); }
        finally { setVerifyBusy(false); }
    };

    const endWork = async () => {
        setVerifyBusy(true); setErr("");
        try { await api.post(`/api/orders/${order.id}/end-work`); onRefresh?.(); }
        catch (e) { setErr(e.response?.data?.message || "Failed"); }
        finally { setVerifyBusy(false); }
    };

    const startMember = async (memberId) => {
        setVerifyBusy(true); setErr("");
        try { await api.post(`/api/orders/${order.id}/members/${memberId}/start`); onRefresh?.(); }
        catch (e) { setErr(e.response?.data?.message || "Failed"); }
        finally { setVerifyBusy(false); }
    };

    const endMember = async (memberId) => {
        setVerifyBusy(true); setErr("");
        try { await api.post(`/api/orders/${order.id}/members/${memberId}/end`); onRefresh?.(); }
        catch (e) { setErr(e.response?.data?.message || "Failed"); }
        finally { setVerifyBusy(false); }
    };

    const isCustom = order.type === "custom";
    const groupActive = order.isGroup && ["paid", "in-progress"].includes(order.status);

    return (
        <div className={`rounded-2xl border-2 bg-white p-4 sm:p-5 ${order.status === "awaiting-verification" ? "border-[#f0b950] shadow-[0_0_0_3px_rgba(240,185,80,0.15)]" : isCustom && ["custom-pending", "quote-proposed"].includes(order.status) ? "border-[#f1cf8a]" : "border-[#eadfce]"}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 truncate text-[10px] uppercase tracking-[.16em] text-[#8a6d53] sm:tracking-[.18em]">
                        <span>Order #{order.id.slice(0, 8)} · {order.username}</span>
                        {eventName && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#7d3f24]/10 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-[#7d3f24]">
                                🎉 {eventName}
                            </span>
                        )}
                    </div>

                    {order.tokenNumber && (
                        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#f1cf8a]/30 border border-[#f1cf8a]/50 px-3 py-1 text-[11px] font-bold text-[#7d3f24]">
                            🎟️ {eventName ? `${eventName} - ` : ""}Token #{order.tokenNumber}
                        </div>
                    )}

                    {order.paymentMethod && (
                        <span className={`ml-2 mt-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${order.paymentMethod === "upi"
                            ? "border-[#1d7a3e]/30 bg-[#e2f0e5] text-[#1d7a3e]"
                            : order.paymentMethod === "card"
                                ? "border-[#2a3a7d]/30 bg-[#e6e8f7] text-[#2a3a7d]"
                                : "border-[#8a6d1c]/30 bg-[#fdf3d6] text-[#8a6d1c]"
                            }`}>
                            {order.paymentMethod === "upi" ? "📱 UPI" : order.paymentMethod === "card" ? "💳 Card" : "💵 Cash"}
                        </span>
                    )}

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                        <span className="inline-flex items-center gap-1.5"><Calendar size={13} className="text-[#7d3f24]" /> {d}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock size={13} className="text-[#7d3f24]" /> {t}</span>
                        {order.proposedDate && order.proposedDate !== order.requestedDate && <span className="rounded-full bg-[#f4eadc] px-2 py-0.5 text-[10px]">rescheduled</span>}
                    </div>
                    <div className="mt-1 truncate text-[11px] text-[#8a6d53] sm:text-xs">{order.email}</div>
                </div>
                <span className={`self-start whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold sm:text-xs ${STATUS.cls}`}>{STATUS.label}</span>
            </div>

            {/* Money status — balance due / refund due */}
            {(Number(order.balanceDue) > 0 || Number(order.refundDue) > 0) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                    {Number(order.balanceDue) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3d6] border border-[#f0b950] px-3 py-1 text-[#8a6d1c]">
                            ⚠️ {currency(order.balanceDue)} balance due
                            {Number(order.paidAmount) > 0 && (
                                <span className="ml-1 font-normal text-[#8a6d53]">
                                    (paid {currency(order.paidAmount)} of {currency(order.total)})
                                </span>
                            )}
                        </span>
                    )}
                    {Number(order.refundDue) > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#f8e4df] border border-[#e6c4be] px-3 py-1 text-[#9b3b2b]">
                                ↩︎ Refund {currency(order.refundDue)} to customer
                                <span className="ml-1 font-normal text-[#8a6d53]">
                                    (paid {currency(order.paidAmount)}, new total {currency(order.total)})
                                </span>
                            </span>
                            <button
                                onClick={acknowledgeRefund}
                                disabled={verifyBusy}
                                className="inline-flex items-center gap-1 rounded-full bg-[#9b3b2b] px-3 py-1 text-[11px] font-bold text-white hover:bg-[#7a2e22] disabled:opacity-60"
                                title="Click once you've paid the customer back in cash / bank transfer"
                            >
                                <CheckCircle2 size={12} /> Refund given
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Group order — per-member controls */}
            {order.isGroup && (
                <div className="mt-3 rounded-2xl border-2 border-dashed border-[#f1cf8a] bg-[#fdf9ef] p-4">
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#7d3f24]">
                        <Users size={12} className="mr-1 inline" /> Group of {order.members.length} · {currency(order.total)}
                    </div>
                    <div className="space-y-2">
                        {order.members.map(m => {
                            const mStatus = m.status || "pending";
                            const canStart = groupActive && mStatus === "pending";
                            const canEnd = mStatus === "in-progress";
                            return (
                                <div key={m.memberId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eadfce] bg-white px-3 py-2">
                                    <div className="flex min-w-0 flex-1 items-center gap-2">
                                        {m.tokenNumber ? (
                                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f1cf8a]/40 border border-[#f1cf8a]/60 px-2.5 py-0.5 text-xs font-bold text-[#7d3f24]">
                                                🎟️ #{m.tokenNumber}
                                            </span>
                                        ) : (
                                            <span className="inline-flex shrink-0 items-center rounded-full bg-[#f4eadc] px-2.5 py-0.5 text-[10px] font-semibold text-[#8a6d53]">
                                                No token
                                            </span>
                                        )}
                                        <span className="truncate text-sm font-semibold">{m.name}</span>
                                        <span className="shrink-0 text-xs text-[#8a6d53]">{currency(m.subtotal)}</span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {mStatus === "in-progress" && <MemberInlineTimer startedAt={m.startedAt} />}
                                        {canStart && (
                                            <button
                                                onClick={() => startMember(m.memberId)}
                                                disabled={verifyBusy}
                                                className="flex items-center gap-1 rounded-full bg-[#7d3f24] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-60"
                                            >
                                                <Play size={11} /> Start
                                            </button>
                                        )}
                                        {canEnd && (
                                            <button
                                                onClick={() => endMember(m.memberId)}
                                                disabled={verifyBusy}
                                                className="flex items-center gap-1 rounded-full bg-[#1d7a3e] px-3 py-1.5 text-[10px] font-bold text-white disabled:opacity-60"
                                            >
                                                <Square size={11} /> End
                                            </button>
                                        )}
                                        {mStatus === "completed" && (
                                            <span className="rounded-full bg-[#e2f0e5] px-2.5 py-0.5 text-[10px] font-bold text-[#1d7a3e]">
                                                ✓ Done {m.durationSeconds >= 60 ? `${Math.round(m.durationSeconds / 60)}m` : `${m.durationSeconds}s`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {groupActive && (
                        <div className="mt-3 text-[11px] italic text-[#8a6d1c]">
                            Use the <strong>Start</strong> / <strong>End</strong> buttons above to work through the group one person at a time.
                        </div>
                    )}
                </div>
            )}

            {/* Custom design block */}
            {isCustom ? (
                <div className="mt-3 rounded-2xl border-2 border-dashed border-[#f1cf8a] bg-[#fdf9ef] p-4">
                    <div className="flex items-start gap-3">
                        {order.customImage && (
                            <button
                                type="button"
                                onClick={() => onViewImage?.(imageUrl(order.customImage), "Reference image")}
                                className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-[#eadfce] bg-white transition hover:ring-2 hover:ring-[#7d3f24]"
                            >
                                <SafeImage src={imageUrl(order.customImage)} alt="Reference" className="h-full w-full object-cover" />
                            </button>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#7d3f24]">🎨 {B.CustomRequest}</div>
                            <div className="mt-1 line-clamp-3 text-xs text-[#5b4636] whitespace-pre-wrap">{order.customDescription}</div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-[#f1cf8a]/40 px-3 py-1 text-[11px] font-bold text-[#7d3f24]">
                                    💰 Suggested: {currency(order.suggestedPrice)}
                                </span>
                                {order.quotedPrice && (
                                    <span className="rounded-full bg-[#fdf3d6] px-3 py-1 text-[11px] font-bold text-[#8a6d1c]">
                                        Counter: {currency(order.quotedPrice)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {order.status === "custom-pending" && (
                        <button
                            onClick={() => onAction({ order, mode: "quote" })}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#7d3f24] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#5f2e18]"
                        >
                            <Palette size={13} /> Review & respond
                        </button>
                    )}

                    {order.status === "quote-proposed" && (
                        <div className="mt-3 rounded-xl bg-[#fdf3d6] px-3 py-2 text-[11px] text-[#8a6d1c]">
                            Counter-offer of <strong>{currency(order.quotedPrice)}</strong> sent to customer. Waiting for their response.
                        </div>
                    )}
                </div>
            ) : order.isGroup ? (
                <div className="mt-3 flex flex-wrap gap-2">
                    {order.members.flatMap(m => m.items || []).map((it, idx) => (
                        <button key={idx} type="button" onClick={() => onViewImage?.(imageUrl(it.image), it.name)} className="h-16 w-14 cursor-zoom-in overflow-hidden rounded-xl border border-[#eadfce] bg-[#eadcc9] transition hover:ring-2 hover:ring-[#7d3f24] sm:h-20 sm:w-16" title={`View ${it.name}`}>
                            <SafeImage src={imageUrl(it.image, "thumb")} alt={it.name} className="h-full w-full object-cover" />
                        </button>
                    ))}
                </div>
            ) : (
                <>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {order.items.map((it, idx) => (
                            <button key={idx} type="button" onClick={() => onViewImage?.(imageUrl(it.image), it.name)} className="h-16 w-14 cursor-zoom-in overflow-hidden rounded-xl border border-[#eadfce] bg-[#eadcc9] transition hover:ring-2 hover:ring-[#7d3f24] sm:h-20 sm:w-16" title={`View ${it.name}`}>
                                <SafeImage src={imageUrl(it.image, "thumb")} alt={it.name} className="h-full w-full object-cover" />
                            </button>
                        ))}
                    </div>

                    <div className="mt-3 grid gap-1 border-t border-[#f0e6d8] pt-3 text-xs sm:text-sm">
                        {order.items.map((it, i) => (
                            <div key={i} className="flex justify-between gap-3 text-[#715e4e]"><span className="min-w-0 truncate">{it.qty}× {it.name}</span><span className="shrink-0">{currency(it.price * it.qty)}</span></div>
                        ))}
                        <div className="mt-1 flex justify-between gap-3 font-semibold"><span>Total</span><span>{currency(order.total)}</span></div>
                    </div>
                </>
            )}

            {order.notes && <div className="mt-3 rounded-xl bg-[#faf5ed] px-3 py-2 text-xs text-[#5b4636]"><strong>User note:</strong> {order.notes}</div>}

            {order.status === "awaiting-verification" && (
                <div className="mt-3 rounded-xl bg-[#fdf3d6] px-3 py-2 text-xs text-[#8a6d1c]">
                    <div className="flex items-center gap-2 font-semibold"><ShieldAlert size={13} /> User claims they paid</div>
                    <div className="mt-1 break-all">UTR / Transaction ID: <span className="font-mono font-bold">{order.utr}</span></div>
                    <div className="mt-1 text-[10px] text-[#8a6d1c]">Check your UPI app / bank statement and match this UTR before confirming.</div>
                </div>
            )}

            {order.status === "paid" && !order.isGroup && (
                <div className="mt-4">
                    <button onClick={startWork} disabled={verifyBusy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#7d3f24] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">
                        <Play size={14} /> {B.sessionStart}
                    </button>
                </div>
            )}

            {order.status === "in-progress" && !order.isGroup && (
                <div className="mt-4 space-y-3">
                    <AdminLiveTimer startedAt={order.startedAt} />
                    <button onClick={endWork} disabled={verifyBusy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1d7a3e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">
                        <Square size={14} /> End session
                    </button>
                </div>
            )}

            {order.status === "completed" && (
                <div className="mt-4 flex items-center gap-2 rounded-full bg-[#e2f0e5] px-4 py-2 text-xs font-semibold text-[#1d7a3e]">
                    <CheckCircle2 size={14} />
                    {order.isGroup
                        ? `Group completed · ${order.members.length} ${order.members.length === 1 ? "person" : "people"}`
                        : `Completed in ${order.durationSeconds >= 60 ? `${Math.round(order.durationSeconds / 60)} min` : `${order.durationSeconds}s`}`}
                </div>
            )}

            {order.status === "pending" && !isCustom && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button onClick={() => onAction({ order, mode: "approve" })} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1d7a3e] px-4 py-2 text-sm font-semibold text-white sm:w-auto"><CheckCircle2 size={14} /> Approve</button>
                    <button onClick={() => onAction({ order, mode: "reject" })} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#e6c4be] bg-white px-4 py-2 text-sm font-semibold text-[#9b3b2b] sm:w-auto"><XCircle size={14} /> Reject</button>
                    <button onClick={() => onAction({ order, mode: "reschedule" })} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#ded0bc] bg-white px-4 py-2 text-sm font-semibold sm:w-auto"><Clock size={14} /> Change date/time</button>
                </div>
            )}

            {order.status === "approved" && ["cash", "card"].includes(order.paymentMethod) && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button onClick={confirmPayment} disabled={verifyBusy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1d7a3e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">
                        <CheckCircle2 size={14} /> Payment received at counter{Number(order.balanceDue) > 0 ? ` · ${currency(order.balanceDue)}` : ""}
                    </button>
                    <button onClick={() => onAction({ order, mode: "reject" })} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#e6c4be] bg-white px-5 py-2.5 text-sm font-semibold text-[#9b3b2b] sm:w-auto">
                        <XCircle size={14} /> Reject / No-show
                    </button>
                </div>
            )}

            {order.status === "awaiting-verification" && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <button onClick={confirmPayment} disabled={verifyBusy} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1d7a3e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"><CheckCircle2 size={14} /> Payment received</button>
                    <button onClick={() => setRejectOpen(true)} disabled={verifyBusy} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#e6c4be] bg-white px-5 py-2.5 text-sm font-semibold text-[#9b3b2b] sm:w-auto"><XCircle size={14} /> Not received</button>
                </div>
            )}

            {order.adminNote && <div className="mt-3 rounded-xl bg-[#f5ecdf] px-3 py-2 text-xs text-[#5b4636]"><strong>Your note:</strong> {order.adminNote}</div>}
            {err && <div className="mt-3 rounded-xl bg-[#f8e4df] px-3 py-2 text-xs text-[#8c392d]">{err}</div>}

            {rejectOpen && (
                <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={() => setRejectOpen(false)}>
                    <div onMouseDown={e => e.stopPropagation()} className="w-full max-w-md rounded-t-[26px] bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
                        <h3 className="serif text-xl font-semibold">Payment not received?</h3>
                        <p className="mt-1 text-xs text-[#8a6d53]">Explain why. The user will be asked to try again.</p>
                        <textarea rows="3" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. UTR not found in bank statement" className="mt-4 w-full rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" />
                        <div className="mt-4 flex gap-2">
                            <button onClick={() => setRejectOpen(false)} className="flex-1 rounded-full border border-[#ded0bc] bg-white px-4 py-3 text-sm font-semibold">Cancel</button>
                            <button onClick={submitReject} disabled={verifyBusy} className="flex-1 rounded-full bg-[#9b3b2b] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{verifyBusy ? "Sending…" : "Notify user"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------- Quote Custom Order Modal ---------- */
function QuoteCustomOrderModal({ order, onClose, onDone }) {
    const [mode, setMode] = useState("accept");
    const [quotedPrice, setQuotedPrice] = useState(order.quotedPrice || "");
    const [adminNote, setAdminNote] = useState(order.adminNote || "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async () => {
        setError("");
        if (mode === "counter" && (!quotedPrice || Number(quotedPrice) <= 0)) {
            return setError("Please enter a valid counter price");
        }
        if (mode === "reject" && !adminNote.trim()) {
            return setError("Please explain why you're rejecting");
        }

        setBusy(true);
        try {
            await api.patch(`/api/orders/${order.id}/quote`, {
                action: mode,
                quotedPrice: mode === "counter" ? Number(quotedPrice) : null,
                adminNote,
            });
            onDone?.();
        } catch (err) {
            setError(err.response?.data?.message || "Could not save");
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-[#20140e]/75 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] bg-[#fffdf9] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px] sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#9a7352]">{B.CustomRequest}</div>
                        <h2 className="serif mt-1 text-2xl font-semibold">Respond to customer</h2>
                        <p className="mt-1 text-xs text-[#8a6d53]">Order #{order.id.slice(0, 8)} · {order.username}</p>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-[#f1e6d8]"><X size={18} /></button>
                </div>

                {order.customImage && (
                    <div className="mt-4">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8a6d53]">Reference image</div>
                        <div className="rounded-2xl border border-[#eadfce] bg-white p-2">
                            <SafeImage src={imageUrl(order.customImage)} alt="Reference" className="max-h-64 w-full rounded-xl object-contain" />
                        </div>
                    </div>
                )}

                <div className="mt-4">
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8a6d53]">Customer's description</div>
                    <div className="rounded-2xl border border-[#eadfce] bg-white p-4 text-sm text-[#5b4636] whitespace-pre-wrap">
                        {order.customDescription || "(no description)"}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border-2 border-[#f1cf8a] bg-[#fdf9ef] px-5 py-4">
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#7d3f24]">Customer's suggested price</div>
                        <div className="mt-1 serif text-3xl font-bold text-[#7d3f24]">{currency(order.suggestedPrice)}</div>
                    </div>
                    <Coins size={28} className="text-[#7d3f24]" />
                </div>

                <div className="mt-3 text-xs text-[#8a6d53]">
                    Requested: <strong className="text-[#24170f]">{order.requestedDate} · {order.requestedTime}</strong>
                </div>

                {order.negotiationHistory?.length > 0 && (
                    <div className="mt-4">
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[#8a6d53]">Negotiation history</div>
                        <div className="space-y-1.5">
                            {order.negotiationHistory.map((h, i) => (
                                <div key={i} className="flex items-center justify-between rounded-xl border border-[#eadfce] bg-white px-3 py-2 text-[11px]">
                                    <span className="text-[#5b4636]">
                                        <strong className="capitalize">{h.by}</strong> · {h.action}
                                        {h.note ? ` — "${h.note}"` : ""}
                                    </span>
                                    <span className="shrink-0 text-[#8a6d53]">
                                        {h.price ? currency(h.price) : ""}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-5 grid grid-cols-3 gap-2">
                    {[
                        { id: "accept", label: "Accept price", cls: "border-[#1d7a3e] bg-[#e2f0e5] text-[#1d7a3e]" },
                        { id: "counter", label: "Counter", cls: "border-[#8a6d1c] bg-[#fdf3d6] text-[#8a6d1c]" },
                        { id: "reject", label: "Reject", cls: "border-[#9b3b2b] bg-[#f8e4df] text-[#9b3b2b]" },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setMode(opt.id)}
                            className={`rounded-2xl border-2 px-3 py-3 text-xs font-bold uppercase tracking-wider transition ${mode === opt.id ? opt.cls : "border-[#eadfce] bg-white text-[#8a6d53] hover:border-[#b07a4f]"}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {mode === "accept" && (
                    <div className="mt-4 rounded-xl bg-[#e2f0e5] px-4 py-3 text-xs text-[#1d7a3e]">
                        You'll accept the customer's suggested price of <strong>{currency(order.suggestedPrice)}</strong>. They can then pay immediately.
                    </div>
                )}

                {mode === "counter" && (
                    <label className="mt-4 grid gap-1.5 text-sm font-semibold text-[#5b4636]">
                        Your counter price <span className="text-red-500">*</span>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7d3f24] font-bold">£</span>
                            <input
                                type="number"
                                min="1"
                                value={quotedPrice}
                                onChange={(e) => setQuotedPrice(e.target.value)}
                                placeholder="e.g. 55"
                                className="w-full rounded-xl border border-[#ddcdb8] bg-white pl-9 pr-4 py-3 text-base font-semibold outline-none focus:ring-2 focus:ring-[#b07a4f]"
                            />
                        </div>
                    </label>
                )}

                <label className="mt-4 grid gap-1.5 text-sm font-semibold text-[#5b4636]">
                    Note to customer {mode === "reject" ? <span className="text-red-500">*</span> : "(optional)"}
                    <textarea
                        rows="3"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder={
                            mode === "accept" ? "e.g. Confirmed, see you then!"
                                : mode === "counter" ? "e.g. Includes both hands + name lettering"
                                    : `e.g. ${B.Item} not feasible at this time`
                        }
                        className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                    />
                </label>

                {error && <div className="mt-3 rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={onClose} className="w-full rounded-full border border-[#ded0bc] bg-white px-4 py-3 text-sm font-semibold sm:flex-1">Cancel</button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className={`w-full rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-1 ${mode === "accept" ? "bg-[#1d7a3e] hover:bg-[#155c2d]"
                            : mode === "counter" ? "bg-[#8a6d1c] hover:bg-[#6b5416]"
                                : "bg-[#9b3b2b] hover:bg-[#7a2e22]"
                            }`}
                    >
                        {busy ? "Sending…" : mode === "accept" ? "Accept & approve" : mode === "counter" ? "Send counter-offer" : "Reject request"}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ---------- Image lightbox ---------- */
function ImageLightbox({ src, alt, onClose }) {
    return (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-3 backdrop-blur-sm sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} className="relative max-h-[92dvh] w-full max-w-5xl overflow-hidden rounded-2xl bg-[#24170f] shadow-2xl sm:rounded-3xl">
                <button onClick={onClose} className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 sm:right-4 sm:top-4" title="Close" aria-label="Close"><X size={20} /></button>
                <SafeImage src={src} alt={alt} eager fallbackClassName="h-64 w-full" className="max-h-[80dvh] w-full object-contain sm:max-h-[88vh] sm:w-auto" />
                <div className="bg-[#24170f] px-4 py-3 text-center text-xs font-semibold text-[#f1cf8a] sm:text-sm">{alt}</div>
            </div>
        </div>
    );
}

/* ---------- Admin: Live Session Timer ---------- */
function AdminLiveTimer({ startedAt }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    if (!startedAt) return null;

    const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;

    const timeString = h > 0
        ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    return (
        <div className="flex items-center gap-4 rounded-2xl border border-[#1d7a3e]/30 bg-gradient-to-r from-[#e2f0e5] via-[#eaf7ee] to-[#f4fbf6] px-4 py-3">
            <div className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1d7a3e] opacity-70" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1d7a3e]" />
            </div>
            <Timer size={22} className="shrink-0 text-[#1d7a3e]" />
            <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#1d7a3e]/80">
                    Session in progress
                </div>
                <div className="serif text-2xl font-bold tabular-nums text-[#1d7a3e] leading-none mt-0.5">
                    {timeString}
                </div>
                <div className="text-[10px] text-[#4a7a5c] mt-0.5">
                    Started at {new Date(startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
            </div>
        </div>
    );
}

/* ---------- Order action modal ---------- */
function OrderActionModal({ order, mode, onClose, onDone }) {
    const [adminNote, setAdminNote] = useState("");
    const [proposedDate, setProposedDate] = useState(order.requestedDate);
    const [proposedTime, setProposedTime] = useState(order.requestedTime);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault(); setBusy(true); setError("");
        try {
            const status = mode === "reject" ? "rejected" : "approved";
            const body = { status, adminNote };
            if (mode === "reschedule") { body.proposedDate = proposedDate; body.proposedTime = proposedTime; }
            await api.patch(`/api/orders/${order.id}/status`, body);
            onDone?.();
        } catch (err) { setError(err.response?.data?.message || "Could not update"); }
        finally { setBusy(false); }
    };

    const title = mode === "approve" ? "Approve appointment" : mode === "reject" ? "Reject appointment" : "Change date/time";

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#20140e]/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
            <div onMouseDown={e => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] bg-[#fffdf9] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px] sm:p-6">
                <h2 className="serif text-2xl font-semibold">{title}</h2>
                <p className="mt-1 text-xs text-[#8a6d53]">Order #{order.id.slice(0, 8)} · {order.username}</p>
                <form onSubmit={submit} className="mt-5 grid gap-3">
                    {mode === "reschedule" && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">New date<input required type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)} className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" /></label>
                            <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">New time<input required type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)} className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" /></label>
                        </div>
                    )}
                    <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">Note to user (optional)<textarea rows="3" value={adminNote} onChange={e => setAdminNote(e.target.value)} className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]" /></label>
                    {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-2.5 text-sm text-[#8c392d]">{error}</div>}
                    <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={onClose} className="w-full rounded-full border border-[#ded0bc] bg-white px-4 py-3 text-sm font-semibold sm:flex-1">Cancel</button>
                        <button disabled={busy} type="submit" className="w-full rounded-full bg-[#24170f] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:flex-1">{busy ? "Saving…" : "Confirm"}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ---------- Add Design modal ---------- */
function AddDesignModal({ categories, industryName, onClose, onSaved }) {
    const [form, setForm] = useState({ name: "", description: "", price: "", amountType: B.defaultAmountType, categoryId: categories[0]?.id || "", featured: false, durationMinutes: 60 });
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const pickFile = (f) => {
        if (!f) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setError("Please choose a JPG, PNG or WebP image."); return; }
        if (f.size > 8 * 1024 * 1024) { setError("Image is too large (max 8 MB)."); return; }
        setError("");
        if (preview) URL.revokeObjectURL(preview);
        setImage(f); setPreview(URL.createObjectURL(f));
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!image) return setError(`Please choose a ${B.item} image.`);
        setBusy(true); setError("");
        const body = new FormData();
        Object.entries(form).forEach(([k, v]) => body.append(k, v));
        body.append("image", image);
        try { await api.post("/api/designs", body); onSaved(); }
        catch (err) { setError(err.response?.data?.message || "Upload failed"); }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[#20140e]/60 backdrop-blur-sm">
            <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
                <div className="w-full max-w-2xl rounded-t-[26px] bg-[#fffdf9] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:my-8 sm:rounded-[30px] sm:p-9">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-[.2em] text-[#9a7352] sm:text-xs">Catalog manager</div>
                            <h2 className="serif mt-1 text-2xl sm:text-3xl">Add {B.item}{industryName ? ` · ${industryName}` : ""}</h2>
                        </div>
                        <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-[#f1e6d8]"><X size={18} /></button>
                    </div>
                    <form onSubmit={submit} className="mt-6 grid gap-4 sm:mt-7 sm:gap-5">
                        <label className="grid gap-2 text-sm font-semibold">
                            Design image
                            <div className="relative rounded-2xl border-2 border-dashed border-[#d9c7b0] bg-[#faf5ed] p-5 text-center sm:p-6">
                                {preview ? <img src={preview} alt="preview" className="mx-auto max-h-40 rounded-xl object-contain sm:max-h-48" /> : <><Upload className="mx-auto text-[#946b49]" /><div className="mt-2 text-xs text-[#8a6d53] sm:text-sm">Choose JPG, PNG or WebP</div></>}
                                <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickFile(e.target.files?.[0])} className="absolute inset-0 cursor-pointer opacity-0" />
                            </div>
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                            <label className="grid gap-2 text-sm font-semibold">{B.Item} name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" /></label>
                            <label className="grid gap-2 text-sm font-semibold">Category<select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 font-normal">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                        </div>
                        <label className="grid gap-2 text-sm font-semibold">Description<textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the motif, coverage, occasion…" className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" /></label>
                        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                            <label className="grid gap-2 text-sm font-semibold">Price<input required type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="1500" className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-[#b07a4f]" /></label>
                            <label className="grid gap-2 text-sm font-semibold">Amount type<select value={form.amountType} onChange={(e) => setForm({ ...form, amountType: e.target.value })} className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 font-normal">{B.amountTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
                            <label className="grid gap-2 text-sm font-semibold">Duration (minutes)<input type="number" min={5} max={600} required value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 font-normal" /></label>
                        </div>
                        <label className="flex items-center gap-3 rounded-xl bg-[#f5ecdf] p-4 text-sm"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />Mark this {B.item} as featured</label>
                        {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}
                        <button disabled={busy} className="flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : `Save ${B.item}`}</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

/* ---------- Admin: Compact inline timer for a group member row ---------- */
function MemberInlineTimer({ startedAt }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    if (!startedAt) return null;
    const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    const timeString = h > 0
        ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fdf3d6] border border-[#f0d98c] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#8a6d1c]">
            <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#8a6d1c] opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#8a6d1c]" />
            </span>
            <Timer size={11} />
            {timeString}
        </span>
    );
}