import { Stars } from "./Stars";

const when = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

export default function ReviewCard({ review, showDesigns = true }) {
    return (
        <article className="flex h-full flex-col rounded-2xl border border-[#eadfce] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <Stars value={review.rating} size={15} />
                <span className="text-[11px] text-[#9a846f]">{when(review.createdAt)}</span>
            </div>
            {review.comment && <p className="mt-3 flex-1 break-words text-sm leading-6 text-[#4a3a2d]">“{review.comment}”</p>}
            <div className="mt-4 flex items-center gap-2 border-t border-[#f0e6d6] pt-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#24170f] text-xs font-bold uppercase text-[#f1cf8a]">
                    {review.username?.[0] || "?"}
                </div>
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{review.username}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#1d7a3e]">Verified booking</div>
                </div>
            </div>
            {showDesigns && review.designs?.length > 0 && (
                <div className="mt-3 truncate text-[11px] text-[#8a6d53]">
                    {review.designs.map((d) => d.name).join(" · ")}
                </div>
            )}
        </article>
    );
}
