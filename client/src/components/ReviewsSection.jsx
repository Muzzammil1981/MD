import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { Stars } from "./Stars";
import ReviewCard from "./ReviewCard";

/* Home page: what customers say. Hidden until the first review exists. */
export default function ReviewsSection() {
    const [data, setData] = useState({ count: 0, average: 0, items: [], hasMore: false, page: 1 });
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        api.get("/api/reviews?limit=6").then(({ data }) => setData(data)).catch(() => { });
    }, []);

    const more = async () => {
        setLoadingMore(true);
        try {
            const { data: next } = await api.get(`/api/reviews?limit=6&page=${data.page + 1}`);
            setData((d) => ({ ...next, items: [...d.items, ...next.items] }));
        } finally { setLoadingMore(false); }
    };

    if (!data.count) return null;

    return (
        <section id="reviews" className="border-t border-[#eadfce] bg-[#fffdf9]">
            <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <div className="text-xs font-bold uppercase tracking-[.24em] text-[#9a7352]">Reviews</div>
                        <h2 className="serif mt-2 text-4xl leading-tight sm:text-5xl">Loved by our customers</h2>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-[#eadfce] bg-white px-5 py-3 shadow-sm">
                        <div className="serif text-4xl font-semibold">{data.average.toFixed(1)}</div>
                        <div>
                            <Stars value={data.average} size={16} />
                            <div className="mt-1 text-xs text-[#8a6d53]">{data.count} review{data.count > 1 ? "s" : ""}</div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.items.map((r) => <ReviewCard key={r.id} review={r} />)}
                </div>

                {data.hasMore && (
                    <div className="mt-8 text-center">
                        <button onClick={more} disabled={loadingMore}
                            className="inline-flex items-center gap-2 rounded-full border border-[#ded0bc] bg-white px-6 py-3 text-sm font-semibold hover:bg-[#f4eadc] disabled:opacity-60">
                            {loadingMore && <Loader2 size={15} className="animate-spin" />} Show more reviews
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
