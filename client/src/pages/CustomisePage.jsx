import { useEffect, useState } from "react";
import { Upload, Sparkles, X, Loader2, CheckCircle2, Palette, Image as ImageIcon, Coins, Calendar } from "lucide-react";
import { api } from "../lib/api";
import { imageUrl, currency } from "../lib/format";
import { B } from "../lib/brand";

export default function CustomisePage({ user, activeEvent, onRequireAuth, onSubmitted }) {
    const isEventMode = Boolean(activeEvent?.id);
    const eventName = activeEvent?.name || "";

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [form, setForm] = useState({
        customDescription: "",
        requestedDate: "",
        requestedTime: "14:00",
        notes: "",
        suggestedPrice: "",
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [uploadedImage, setUploadedImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(null);

    // Default the date to tomorrow ONLY for non-event custom orders
    useEffect(() => {
        if (isEventMode) return;
        if (!form.requestedDate) setForm(f => ({ ...f, requestedDate: tomorrow }));
    }, []);

    const pickFile = async (f) => {
        if (!f) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
            setError("Please choose a JPG, PNG or WebP image."); return;
        }
        if (f.size > 8 * 1024 * 1024) {
            setError("Image is too large (max 8 MB)."); return;
        }
        setError("");
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImageFile(f);
        setImagePreview(URL.createObjectURL(f));
        setUploadedImage(null);

        setUploading(true);
        try {
            const body = new FormData();
            body.append("image", f);
            const { data } = await api.post("/api/designs/custom-image", body);
            setUploadedImage(data);
        } catch (err) {
            setError(err.response?.data?.message || "Image upload failed");
            setImageFile(null); setImagePreview("");
        } finally { setUploading(false); }
    };

    const resetForm = () => {
        setDone(null);
        setForm({
            customDescription: "",
            requestedDate: isEventMode ? "" : tomorrow,
            requestedTime: "14:00",
            notes: "",
            suggestedPrice: "",
        });
        setImageFile(null); setImagePreview(""); setUploadedImage(null);
    };

    const submit = async (e) => {
        e.preventDefault();
        setError("");

        if (!user) { onRequireAuth?.(); return; }
        if (!form.customDescription.trim()) return setError(`Please describe your ${B.custom}`);
        if (!form.suggestedPrice || Number(form.suggestedPrice) <= 0) return setError("Please suggest a price");

        // Date/time only required for non-event custom orders
        if (!isEventMode) {
            if (!form.requestedDate) return setError("Please pick a date");
            if (!form.requestedTime) return setError("Please pick a time");
        }

        setBusy(true);
        try {
            // For event custom orders: auto-fill date/time with "now"
            const now = new Date();
            const autoDate = now.toISOString().slice(0, 10);
            const autoTime = now.toTimeString().slice(0, 5);

            const payload = {
                customDescription: form.customDescription.trim(),
                customImageId: uploadedImage?.imageId || null,
                customImage: uploadedImage?.image || null,
                suggestedPrice: Number(form.suggestedPrice),
                requestedDate: isEventMode ? autoDate : form.requestedDate,
                requestedTime: isEventMode ? autoTime : form.requestedTime,
                notes: form.notes.trim(),
            };

            if (isEventMode) payload.eventId = activeEvent.id;

            const { data } = await api.post("/api/orders/custom", payload);
            setDone(data);
            onSubmitted?.(data);
        } catch (err) {
            setError(err.response?.data?.message || "Could not submit request");
        } finally { setBusy(false); }
    };

    if (done) {
        return (
            <div className="min-h-[60vh] grid place-items-center px-5 py-16">
                <div className="max-w-lg text-center">
                    <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#e2f0e5] text-[#1d7a3e]">
                        <CheckCircle2 size={32} />
                    </div>
                    <h2 className="serif text-3xl font-bold text-[#24170f]">Request received!</h2>
                    <p className="mt-3 text-sm leading-7 text-[#715e4e]">
                        You suggested <strong className="text-[#7d3f24]">{currency(done.suggestedPrice)}</strong>. Our studio will review your {B.item} and either accept your price or send a counter-offer.
                    </p>
                    <div className="mt-6 rounded-xl bg-[#f5ecdf] px-5 py-4 text-left text-xs text-[#5b4636]">
                        <div className="font-semibold text-[#24170f]">What happens next?</div>
                        <ol className="mt-2 space-y-1.5 list-decimal list-inside">
                            <li>Studio reviews your reference image</li>
                            <li>They accept your price OR send a counter-offer</li>
                            <li>You approve the final price</li>
                            <li>Pay online (UPI) or at the counter (Cash/Card)</li>
                            {isEventMode && (
                                <li>Your <strong>event token</strong> is issued for <strong>{eventName}</strong> once payment is confirmed</li>
                            )}
                        </ol>
                    </div>
                    <button
                        onClick={resetForm}
                        className="mt-6 rounded-full border border-[#ded0bc] bg-white px-6 py-3 text-sm font-semibold text-[#5b4636] hover:bg-[#f4eadc]"
                    >
                        Submit another request
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
            <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#f1cf8a]/40 bg-[#f1cf8a]/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#7d3f24]">
                    <Sparkles size={13} /> {isEventMode ? `${B.Custom} · ${eventName}` : `${B.Custom}`}
                </div>
                <h1 className="serif mt-5 text-4xl font-bold text-[#24170f] sm:text-5xl">
                    Your design, your price
                </h1>
                <p className="mx-auto mt-3 max-w-xl text-sm text-[#715e4e] sm:text-base">
                    Upload a reference image, describe what you want, and suggest a price. The studio will accept it or send a counter-offer.
                </p>
            </div>

            <form onSubmit={submit} className="mt-10 space-y-6 rounded-3xl border border-[#eadfce] bg-white p-6 sm:p-8">

                {/* Reference image */}
                <div>
                    <label className="mb-2 block text-sm font-semibold text-[#5b4636]">Reference image (optional)</label>
                    <div className="relative rounded-2xl border-2 border-dashed border-[#d9c7b0] bg-[#faf5ed] p-5 text-center sm:p-6 transition hover:border-[#b07a4f]">
                        {imagePreview ? (
                            <div className="relative mx-auto max-w-xs">
                                <img src={imagePreview} alt="preview" className="mx-auto max-h-56 rounded-xl object-contain" />
                                <button
                                    type="button"
                                    onClick={() => { setImageFile(null); setImagePreview(""); setUploadedImage(null); }}
                                    className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white hover:bg-black/90"
                                >
                                    <X size={14} />
                                </button>
                                {uploading && (
                                    <div className="mt-2 text-xs text-[#8a6d53] flex items-center justify-center gap-1.5">
                                        <Loader2 size={12} className="animate-spin" /> Uploading…
                                    </div>
                                )}
                                {!uploading && uploadedImage && (
                                    <div className="mt-2 text-xs text-[#1d7a3e] flex items-center justify-center gap-1.5">
                                        <CheckCircle2 size={12} /> Reference uploaded
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <ImageIcon className="mx-auto text-[#946b49]" size={32} />
                                <div className="mt-2 text-sm font-semibold text-[#24170f]">Upload your inspiration</div>
                                <div className="mt-1 text-xs text-[#8a6d53]">Screenshot from Instagram, Pinterest, or any image up to 8 MB</div>
                            </>
                        )}
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => pickFile(e.target.files?.[0])}
                            className="absolute inset-0 cursor-pointer opacity-0"
                        />
                    </div>
                </div>

                {/* Description */}
                <label className="block">
                    <div className="mb-2 text-sm font-semibold text-[#5b4636]">
                        Describe your custom design <span className="text-red-500">*</span>
                    </div>
                    <textarea
                        required
                        rows="4"
                        value={form.customDescription}
                        onChange={(e) => setForm({ ...form, customDescription: e.target.value })}
                        placeholder={B.customPlaceholder}
                        className="w-full rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                    />
                </label>

                {/* Suggested price */}
                <label className="block">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#5b4636]">
                        <Coins size={15} className="text-[#7d3f24]" />
                        Your suggested price <span className="text-red-500">*</span>
                    </div>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7d3f24] font-bold">£</span>
                        <input
                            required
                            type="number"
                            min="1"
                            step="1"
                            value={form.suggestedPrice}
                            onChange={(e) => setForm({ ...form, suggestedPrice: e.target.value })}
                            placeholder="e.g. 40"
                            className="w-full rounded-xl border border-[#ddcdb8] bg-white pl-9 pr-4 py-3 text-base font-semibold outline-none focus:ring-2 focus:ring-[#b07a4f]"
                        />
                    </div>
                    <div className="mt-1.5 text-[11px] text-[#8a6d53]">
                        The studio will review your suggestion. They may accept it or propose a different price.
                    </div>
                </label>

                {/* FCFS banner — event mode only */}
                {isEventMode && (
                    <div className="rounded-xl bg-[#fdf3d6] border border-[#f0d98c] p-4 text-sm text-[#8a6d1c]">
                        <div className="font-semibold flex items-center gap-2">
                            <Sparkles size={16} /> First Come, First Serve
                        </div>
                        <p className="mt-1 text-xs">
                            You're ordering for <strong>{eventName}</strong>. Your <strong>event token</strong> will be generated automatically once your payment is confirmed — no appointment date needed.
                        </p>
                    </div>
                )}

                {/* Date + Time — hidden in event mode */}
                {!isEventMode && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Preferred date
                            <input
                                required
                                type="date"
                                min={tomorrow}
                                value={form.requestedDate}
                                onChange={(e) => setForm({ ...form, requestedDate: e.target.value })}
                                className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                            />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
                            Preferred time
                            <input
                                required
                                type="time"
                                value={form.requestedTime}
                                onChange={(e) => setForm({ ...form, requestedTime: e.target.value })}
                                className="rounded-xl border border-[#ddcdb8] bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                            />
                        </label>
                    </div>
                )}

                {/* Extra notes */}
                <label className="block">
                    <div className="mb-2 text-sm font-semibold text-[#5b4636]">Extra notes (optional)</div>
                    <input
                        type="text"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Any allergies, preferences, occasion…"
                        className="w-full rounded-xl border border-[#ddcdb8] bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                    />
                </label>

                {error && <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}

                <button
                    disabled={busy || uploading}
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                >
                    {busy ? (
                        <><Loader2 size={15} className="animate-spin" /> Sending request…</>
                    ) : (
                        <><Palette size={16} /> Send custom request</>
                    )}
                </button>
            </form>
        </div>
    );
}