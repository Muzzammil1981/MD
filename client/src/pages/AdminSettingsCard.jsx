import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, QrCode, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { B } from "../lib/brand";

export default function AdminSettingsCard({ role }) {
    const [settings, setSettings] = useState({ upiId: "", merchantName: B.name });
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const load = async () => {
        try {
            const { data } = await api.get("/api/settings");
            setSettings({
                upiId: data.upiId || "",
                merchantName: data.merchantName || B.name,
            });
        } catch { /* ignore */ }
    };

    useEffect(() => { load(); }, []);

    const save = async (e) => {
        e.preventDefault();
        setBusy(true); setError(""); setMessage("");
        try {
            await api.post("/api/settings", settings);
            setMessage("Saved — QR codes will now include this UPI ID");
            setTimeout(() => setMessage(""), 3000);
        } catch (err) {
            setError(err.response?.data?.message || "Save failed");
        } finally {
            setBusy(false);
        }
    };

    const configured = Boolean(settings.upiId);

    return (
        <div className="rounded-2xl border border-[#eadfce] bg-white p-4 sm:rounded-3xl sm:p-6">
            {/* Header — stacks on mobile, side-by-side on ≥sm */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f1cf8a]/40 text-[#7d3f24]">
                        <QrCode size={20} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="serif text-xl font-semibold sm:text-2xl">Payment settings</h2>
                        <p className="text-xs text-[#8a6d53]">
                            {role === "SUPERADMIN"
                                ? "Used for normal (home page) bookings - dynamic UPI QR with the amount pre-filled"
                                : "Used for the UPI QR on YOUR events only. Leave blank if you take cash/card at the counter."}
                        </p>
                    </div>
                </div>

                <span
                    className={`inline-flex shrink-0 items-center gap-1 self-start whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold sm:text-xs ${configured
                            ? "bg-[#e2f0e5] text-[#1d7a3e]"
                            : "bg-[#f8e4df] text-[#8c392d]"
                        }`}
                >
                    {configured ? (
                        <>
                            <CheckCircle2 size={12} /> Configured
                        </>
                    ) : (
                        <>
                            <AlertCircle size={12} /> Not configured
                        </>
                    )}
                </span>
            </div>

            {/* Form */}
            <form onSubmit={save} className="mt-5 grid gap-3">
                <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                    UPI ID (VPA) *
                    <input
                        required
                        value={settings.upiId}
                        onChange={e => setSettings({ ...settings, upiId: e.target.value })}
                        placeholder="yourname@upi"
                        autoComplete="off"
                        className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                    />
                </label>

                <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                    Merchant name (shown on UPI app)
                    <input
                        value={settings.merchantName}
                        onChange={e => setSettings({ ...settings, merchantName: e.target.value })}
                        placeholder={B.name}
                        className="rounded-xl border border-[#ddcdb8] bg-white px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                    />
                </label>

                <button
                    disabled={busy}
                    className="mt-1 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 sm:w-auto sm:self-start"
                >
                    {busy ? (
                        <>
                            <Loader2 size={13} className="animate-spin" /> Saving…
                        </>
                    ) : (
                        "Save settings"
                    )}
                </button>

                {message && (
                    <div className="flex items-center gap-2 rounded-xl bg-[#e2f0e5] px-4 py-2 text-xs font-semibold text-[#1d7a3e]">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span className="min-w-0 break-words">{message}</span>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl bg-[#f8e4df] px-4 py-2 text-xs text-[#8c392d]">
                        {error}
                    </div>
                )}
            </form>

            {/* Info box */}
            <div className="mt-4 rounded-xl bg-[#faf5ed] px-4 py-3 text-[11px] leading-5 text-[#5b4636]">
                <strong>How it works:</strong> when a user clicks Pay now, the app generates a
                UPI QR with the amount already filled in. Users open GPay / PhonePe / Paytm /
                BHIM, scan, and confirm — no typing, no mistakes.
            </div>
        </div>
    );
}