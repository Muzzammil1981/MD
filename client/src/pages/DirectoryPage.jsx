import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Store, Sparkles } from "lucide-react";
import { api } from "../lib/api";

/* The main address "/": every published business. Customers pick one and continue on its own address. */
export default function DirectoryPage() {
    const [list, setList] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        // old event QR codes pointed to /?event=ID  → send them to the right business
        const eventId = new URLSearchParams(window.location.search).get("event");
        if (eventId) {
            api.get(`/api/events/${encodeURIComponent(eventId)}`)
                .then(({ data }) => { if (data.businessSlug) window.location.replace(`/${data.businessSlug}?event=${encodeURIComponent(eventId)}`); })
                .catch(() => { });
        }
        api.get("/api/businesses").then(({ data }) => setList(data))
            .catch(() => setError("Could not reach the server. Please try again in a moment."));
    }, []);

    return (
        <div className="min-h-screen bg-[#fbf8f2] text-[#2a1a12]">
            <header className="border-b border-[#eadfce]">
                <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-5">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-[#24170f] text-[#f1cf8a]"><Store size={18} /></div>
                        <div className="serif text-xl font-bold tracking-tight">Our businesses</div>
                    </div>
                    <a href="/admin" className="rounded-full border border-[#ded0bc] bg-white px-4 py-1.5 text-sm font-medium hover:bg-[#f4eadc]">Admin</a>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-5 py-14">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#dfc9a8] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[.18em] text-[#835b38]"><Sparkles size={14} /> Book online</div>
                <h1 className="serif mt-5 text-4xl font-semibold leading-tight sm:text-6xl">Choose a business</h1>
                <p className="mt-4 max-w-xl text-[#715e4e]">Pick the place you want to book with. One account works everywhere.</p>

                {error && <div className="mt-8 rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">{error}</div>}
                {!list && !error && <div className="mt-12 grid place-items-center text-[#8a6d53]"><Loader2 className="animate-spin" /></div>}
                {list && list.length === 0 && <div className="mt-10 rounded-2xl border border-dashed border-[#d9c7b0] bg-white p-10 text-center text-sm text-[#8a6d53]">No business is open for booking yet.</div>}

                {list && list.length > 0 && (
                    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {list.map((b) => (
                            <a key={b.slug} href={`/${b.slug}`}
                                className="group flex flex-col rounded-3xl border border-[#eadfce] bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#24170f] text-[#f1cf8a]"><span className="serif text-xl">{(b.name || "?")[0].toUpperCase()}</span></div>
                                <div className="serif mt-5 text-2xl font-semibold leading-tight">{b.name}</div>
                                <div className="mt-1 text-sm text-[#715e4e]">{b.tagline}</div>
                                <div className="mt-5 flex items-center justify-between text-xs font-semibold text-[#8a6d53]">
                                    <span>{b.categories} {b.categories === 1 ? "category" : "categories"}</span>
                                    <span className="flex items-center gap-1 text-[#7d3f24]">Open <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export function NotFoundPage() {
    return (
        <div className="grid min-h-screen place-items-center bg-[#fbf8f2] p-6 text-center text-[#2a1a12]">
            <div>
                <div className="serif text-6xl font-semibold text-[#8c4e2f]">404</div>
                <h1 className="serif mt-3 text-3xl font-semibold">We couldn't find that business</h1>
                <p className="mt-2 text-sm text-[#715e4e]">The address may be wrong, or the business isn't open for booking yet.</p>
                <a href="/" className="mt-6 inline-flex rounded-full bg-[#24170f] px-6 py-3 text-sm font-semibold text-white">See all businesses</a>
            </div>
        </div>
    );
}
