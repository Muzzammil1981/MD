import { Sparkles, Star, ShoppingBag, ArrowRight, Search, Bell, CheckCircle2 } from "lucide-react";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

/* A live copy of the customer website, drawn from the wording being typed (not yet saved).
   It mirrors the real page layout so you can judge length and tone while you edit. */
export default function WordingPreview({ v, categories = [] }) {
    const name = v.name || "Your business";
    const item = v.item || "item";
    const items = v.items || "items";
    const cats = categories.length ? categories : [{ id: "x", shortName: "Category 1", name: "Category 1" }, { id: "y", shortName: "Category 2", name: "Category 2" }];
    const catCount = categories.length || cats.length;

    return (
        <div className="overflow-hidden rounded-2xl border border-[#d9c7b0] bg-[#fbf8f2] text-[#2a1a12] shadow-sm">
            {/* browser bar */}
            <div className="flex items-center gap-1.5 border-b border-[#eadfce] bg-[#f1e8da] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-[#e0a49a]" /><span className="h-2 w-2 rounded-full bg-[#e8cf8c]" /><span className="h-2 w-2 rounded-full bg-[#a9cfa8]" />
                <span className="ml-2 truncate rounded-full bg-white px-3 py-0.5 text-[10px] text-[#8a6d53]">{name} - {v.tagline}</span>
            </div>

            <div className="max-h-[78vh] overflow-y-auto text-[11px] leading-snug">
                {/* header */}
                <div className="flex items-center justify-between gap-2 border-b border-[#eadfce] bg-[#fbf8f2] px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#24170f] text-[#f1cf8a]"><span className="serif text-sm">{(name[0] || "?").toUpperCase()}</span></div>
                        <div className="min-w-0">
                            <div className="serif truncate text-sm font-bold">{name}</div>
                            <div className="truncate text-[7px] uppercase tracking-[.22em] text-[#8a6d53]">{v.tagline}</div>
                        </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2.5 text-[9px] font-medium sm:flex">
                        <span>{cap(items)}</span><span>Categories</span><span>✨ Customise</span><span>Our Story</span>
                    </div>
                </div>

                {/* hero */}
                <div className="grid gap-3 bg-[radial-gradient(#e6d9c6_1px,transparent_1px)] [background-size:14px_14px] px-4 py-6 sm:grid-cols-[1.2fr_.8fr] sm:items-center">
                    <div>
                        <div className="inline-flex items-center gap-1 rounded-full border border-[#dfc9a8] bg-white/70 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[.15em] text-[#835b38]"><Sparkles size={9} /> {v.heroKicker}</div>
                        <h1 className="serif mt-3 text-2xl font-semibold leading-[1.02] tracking-tight">{v.heroTitle1}<br /><span className="italic text-[#8c4e2f]">{v.heroTitle2}</span></h1>
                        <p className="mt-3 max-w-sm text-[10px] leading-4 text-[#715e4e]">{v.heroText}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#24170f] px-3 py-1.5 text-[9px] font-semibold text-white">{v.exploreLabel} <ArrowRight size={10} /></span>
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#ddcdb8] bg-white/70 px-2.5 py-1.5 text-[9px] text-[#715e4e]"><Star size={9} className="fill-[#bd8b48] text-[#bd8b48]" /> {v.heroBadge}</span>
                        </div>
                    </div>
                    <div className="relative mx-auto aspect-[4/5] w-24 sm:w-full sm:max-w-[120px]">
                        <div className="absolute inset-0 overflow-hidden rounded-[45%_45%_10%_10%] border border-white/70 bg-gradient-to-b from-[#eadac7] to-[#d1b595]">
                            <div className="absolute inset-x-1 bottom-2 text-center text-[#6f4027]"><div className="serif truncate text-sm italic">{v.heroArt}</div><div className="truncate text-[5px] uppercase tracking-[.3em]">{v.heroArtSub}</div></div>
                        </div>
                        <div className="absolute -bottom-2 -left-3 rounded-lg border border-[#e2d1bb] bg-white/90 px-2 py-1 shadow"><div className="text-[5px] uppercase tracking-widest text-[#92765c]">Collection</div><div className="serif text-[9px]">{catCount} {v.heroCardTitle}</div></div>
                    </div>
                </div>

                {/* category rail */}
                <div className="flex gap-1.5 overflow-hidden border-y border-[#eadfce] bg-[#fffdf9] px-3 py-2.5">
                    <span className="shrink-0 rounded-full bg-[#24170f] px-2.5 py-1 text-[9px] font-semibold text-white">{v.allLabel}</span>
                    {cats.slice(0, 7).map((c) => <span key={c.id} className="shrink-0 rounded-full border border-[#ded0bc] bg-white px-2.5 py-1 text-[9px] font-semibold">{c.shortName || c.name}</span>)}
                </div>

                {/* catalogue */}
                <div className="px-4 py-5">
                    <div className="text-[8px] font-bold uppercase tracking-[.22em] text-[#9b6d43]">{v.catalogKicker}</div>
                    <div className="serif mt-1 text-lg font-semibold leading-tight">{v.catalogTitle}</div>
                    <div className="mt-2 flex items-center gap-1.5 rounded-full border border-[#e4d3b9] bg-white px-3 py-1.5 text-[9px] text-[#a38974]"><Search size={10} /> Search {items}, categories…</div>
                    <div className="mt-3 flex gap-2.5">
                        <div className="w-24 overflow-hidden rounded-xl border border-[#eadfce] bg-white">
                            <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-[#ead7bf] to-[#dcc3a3] text-[#9b6d43]"><ShoppingBag size={16} /></div>
                            <div className="p-1.5"><div className="truncate text-[7px] text-[#8a6d53]">{cats[0]?.name}</div><div className="serif truncate text-[10px] font-semibold">Sample {item}</div>
                                <div className="mt-0.5 text-[9px] font-bold">£12.00 <span className="text-[7px] font-normal text-[#8a6d53]">{(v.amountTypes || "").split("\n")[0]}</span></div>
                                <div className="mt-1 rounded-full bg-[#24170f] py-1 text-center text-[7px] font-semibold text-white">Add to selection</div></div>
                        </div>
                        <div className="flex-1 rounded-xl border border-dashed border-[#d9c7b0] p-2 text-[9px] text-[#8a6d53]">{v.defaultDescription}<div className="mt-1.5 rounded-full border border-[#ded0bc] bg-white px-2 py-1 text-center text-[8px] font-semibold text-[#5b4636]">{v.browseLabel}</div></div>
                    </div>
                </div>

                {/* story */}
                <div className="bg-[#24170f] px-4 py-6 text-[#fff9ef]">
                    <div className="text-[8px] font-bold uppercase tracking-[.22em] text-[#d8b37b]">{v.storyKicker}</div>
                    <div className="serif mt-1.5 text-lg leading-tight">{v.storyTitle}</div>
                    <p className="mt-2 text-[9px] leading-4 text-[#d9c9b8]">{v.storyText}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center">
                        {[[String(catCount).padStart(2, "0"), v.storyStat1], ["∞", v.storyStat2], ["01", v.storyStat3]].map(([n, l], i) => (
                            <div key={i}><div className="serif text-base text-white">{n}</div><div className="text-[7px] uppercase tracking-[.14em]">{l}</div></div>
                        ))}
                    </div>
                </div>

                {/* footer */}
                <div className="bg-[#1b100b] px-4 py-5 text-center text-[#aa9480]">
                    <div className="serif text-sm text-[#eee0cf]">{name}</div>
                    <div className="mt-1 text-[9px]">{v.footerTagline}</div>
                </div>

                {/* messages */}
                <div className="space-y-2.5 border-t-4 border-[#eadfce] bg-white px-4 py-4">
                    <div className="text-[8px] font-bold uppercase tracking-[.2em] text-[#9a7352]">Messages customers &amp; staff see</div>
                    <div className="flex items-start gap-2 rounded-lg border border-[#eadfce] bg-[#fdf9ef] p-2"><Bell size={11} className="mt-0.5 shrink-0 text-[#7d3f24]" /><div><div className="text-[9px] font-semibold">{v.startedTitle}</div><div className="text-[8px] text-[#8a6d53]">{v.sessionWorking}</div></div></div>
                    <div className="flex items-start gap-2 rounded-lg border border-[#c8e6d2] bg-[#eaf7ee] p-2"><CheckCircle2 size={11} className="mt-0.5 shrink-0 text-[#1d7a3e]" /><div><div className="text-[9px] font-semibold text-[#1d7a3e]">{v.readyTitle}</div><div className="text-[8px] text-[#3d5c47]">{v.readyGroup}</div></div></div>
                    <div className="rounded-lg border border-[#eadfce] p-2"><div className="text-[9px] font-semibold">{v.reviewPrompt}</div><div className="mt-1 rounded border border-[#ddcdb8] px-2 py-1 text-[8px] text-[#a38974]">{v.reviewHint}</div></div>
                    <div className="rounded-lg border border-dashed border-[#f1cf8a] bg-[#fdf9ef] p-2"><div className="text-[8px] font-bold uppercase tracking-widest text-[#7d3f24]">🎨 {cap(v.customRequest || "request")}</div><div className="mt-1 text-[8px] italic text-[#8a6d53]">{v.customPlaceholder}</div></div>
                    <div className="flex flex-wrap gap-1.5 text-[8px]"><span className="rounded-full bg-[#24170f] px-2.5 py-1 font-semibold text-white">▶ {v.sessionStart}</span><span className="rounded-full bg-[#f1cf8a]/40 px-2.5 py-1 font-semibold text-[#7d3f24]">Event: {v.eventSubtitle}</span></div>
                </div>
            </div>
        </div>
    );
}
