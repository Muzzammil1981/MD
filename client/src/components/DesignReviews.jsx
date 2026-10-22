import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Stars } from "./Stars";

/* Reviews of customers who booked THIS design - shown inside the design popup */
export default function DesignReviews({ designId }) {
    const [data, setData] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        setData(null);
        api.get(`/api/reviews?designId=${encodeURIComponent(designId)}&limit=3`)
            .then(({ data }) => setData(data)).catch(() => setData({ count: 0, items: [] }));
    }, [designId]);

    const more = async () => {
        setLoadingMore(true);
        try {
            const { data: next } = await api.get(`/api/reviews?designId=${encodeURIComponent(designId)}&limit=3&page=${data.page + 1}`);
            setData((d) => ({ ...next, items: [...d.items, ...next.items] }));
        } finally { setLoadingMore(false); }
    };

    if (!data) return <div className="mt-6 text-center text-[#9a846f]"><Loader2 size={16} className="mx-auto animate-spin" /></div>;
    if (!data.count) return null;

    return (
        <div className="mt-6 border-t border-[#eadcc9] pt-5">
            <div className="flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9a7352] sm:text-xs">Customer reviews</div>
                <div className="flex items-center gap-2">
                    <Stars value={data.average} size={13} />
                    <span className="text-xs font-semibold">{data.average.toFixed(1)}</span>
                    <span className="text-xs text-[#9a846f]">({data.count})</span>
                </div>
            </div>
            <div className="mt-3 space-y-3">
                {data.items.map((r) => (
                    <div key={r.id} className="rounded-xl bg-[#f6efe4] p-3">
                        <div className="flex items-center justify-between gap-2">
                            <Stars value={r.rating} size={12} />
                            <span className="truncate text-[11px] font-semibold text-[#5b4636]">{r.username}</span>
                        </div>
                        {r.comment && <p className="mt-1.5 break-words text-xs leading-5 text-[#4a3a2d]">{r.comment}</p>}
                    </div>
                ))}
            </div>
            {data.hasMore && (
                <button onClick={more} disabled={loadingMore} className="mt-3 text-xs font-semibold text-[#7d3f24] hover:underline disabled:opacity-60">
                    {loadingMore ? "Loading…" : "Show more"}
                </button>
            )}
        </div>
    );
}
