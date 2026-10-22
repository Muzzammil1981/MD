import { useState } from "react";
import { Lock, User, Sparkles, Loader2 } from "lucide-react";
import { api } from "../lib/api"
import { B } from "../lib/brand";

export default function LoginPage({ onLogin }) {
    const [form, setForm] = useState({ username: "", password: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            const { data } = await api.post("/api/auth/login", form);
            localStorage.setItem("mehndi-token", data.token);
            onLogin(data.user);
        } catch (err) {
            setError(err.response?.data?.message || "Login failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#1b100b] px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
            {/* Decorative layers */}
            <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{
                    backgroundImage: "radial-gradient(#c69a63 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                }}
            />
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#7d3f24]/30 blur-3xl sm:-left-24 sm:-top-24 sm:h-72 sm:w-72" />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-[#c69a63]/20 blur-3xl sm:-bottom-24 sm:-right-24 sm:h-72 sm:w-72" />

            <form
                onSubmit={submit}
                className="relative w-full max-w-md rounded-2xl border border-[#3a2418] bg-[#24170f]/90 p-6 shadow-2xl backdrop-blur-xl sm:rounded-[32px] sm:p-10"
            >
                {/* Brand */}
                <div className="mb-6 text-center sm:mb-8">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f1cf8a] text-[#24170f] sm:h-14 sm:w-14">
                        <Sparkles size={20} className="sm:hidden" />
                        <Sparkles size={22} className="hidden sm:block" />
                    </div>
                    <h1 className="serif mt-3 text-2xl font-semibold text-[#fff5e6] sm:mt-4 sm:text-3xl">
                        {B.name}
                    </h1>
                    <p className="mt-1 text-[10px] uppercase tracking-[.22em] text-[#c69a63] sm:text-xs sm:tracking-[.28em]">
                        Studio Management Portal
                    </p>
                </div>

                {/* Username */}
                <label className="grid gap-2 text-sm font-medium text-[#e8d6bd]">
                    Username
                    <div className="relative">
                        <User
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a4826a]"
                        />
                        <input
                            autoFocus
                            required
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                            placeholder="admin"
                            autoComplete="username"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            className="w-full rounded-xl border border-[#3a2418] bg-[#1b100b] py-3.5 pl-11 pr-4 text-base text-[#fff5e6] outline-none transition focus:border-[#c69a63] sm:text-sm"
                        />
                    </div>
                </label>

                {/* Password */}
                <label className="mt-4 grid gap-2 text-sm font-medium text-[#e8d6bd] sm:mt-5">
                    Password
                    <div className="relative">
                        <Lock
                            size={16}
                            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#a4826a]"
                        />
                        <input
                            required
                            type="password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            className="w-full rounded-xl border border-[#3a2418] bg-[#1b100b] py-3.5 pl-11 pr-4 text-base text-[#fff5e6] outline-none transition focus:border-[#c69a63] sm:text-sm"
                        />
                    </div>
                </label>

                {error && (
                    <div className="mt-4 rounded-xl border border-[#7d3f24]/40 bg-[#7d3f24]/15 px-4 py-2.5 text-sm text-[#f1c8b6]">
                        {error}
                    </div>
                )}

                <button
                    disabled={busy}
                    className="mt-6 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#f1cf8a] px-6 py-3.5 font-semibold text-[#24170f] transition hover:brightness-105 disabled:opacity-60 sm:mt-7"
                >
                    {busy ? <Loader2 className="animate-spin" size={17} /> : null}
                    {busy ? "Signing in..." : "Sign in"}
                </button>

                <p className="mt-5 text-center text-[10px] uppercase tracking-[.18em] text-[#7a6250] sm:mt-6 sm:text-[11px] sm:tracking-[.22em]">
                    Secure Studio Administration
                </p>
            </form>
        </div>
    );
}