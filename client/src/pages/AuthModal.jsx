import { useState } from "react";
import { X, User, Mail, Lock, Loader2, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { B } from "../lib/brand";

export default function AuthModal({ onClose, onSuccess, reason }) {
    const [mode, setMode] = useState("signin"); // "signin" | "signup"
    const [form, setForm] = useState({
        identifier: "", username: "", email: "", fullName: "", password: "",
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true); setError("");
        try {
            let data;
            if (mode === "signup") {
                ({ data } = await api.post("/api/users/register", {
                    username: form.username,
                    email: form.email,
                    fullName: form.fullName,
                    password: form.password,
                }));
            } else {
                ({ data } = await api.post("/api/users/login", {
                    identifier: form.identifier,
                    password: form.password,
                }));
            }
            localStorage.setItem("mehndi-user-token", data.token);
            onSuccess(data.user);
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-[#20140e]/70 backdrop-blur-sm sm:items-center sm:p-4"
            onMouseDown={onClose}
        >
            <div
                onMouseDown={e => e.stopPropagation()}
                className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] bg-[#fffdf9] shadow-2xl sm:max-h-[90vh] sm:rounded-[28px]"
            >
                {/* Header */}
                <div className="relative shrink-0 bg-[#24170f] p-5 text-[#f1cf8a] sm:p-6">
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#f1cf8a] transition hover:bg-white/10 sm:right-4 sm:top-4 sm:h-10 sm:w-10"
                    >
                        <X size={18} />
                    </button>

                    <div className="flex items-center gap-2 pr-10 text-[10px] uppercase tracking-[.2em] sm:text-xs sm:tracking-[.24em]">
                        <Sparkles size={14} />
                        {mode === "signup" ? "Create account" : "Welcome back"}
                    </div>

                    <h2 className="serif mt-2 pr-10 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                        {mode === "signup" ? `Join ${B.name}` : "Sign in to continue"}
                    </h2>

                    {reason && (
                        <p className="mt-2 max-w-[95%] text-[11px] leading-4 text-[#d9c9b8] sm:text-xs sm:leading-5">
                            {reason}
                        </p>
                    )}
                </div>

                {/* Scrollable form body */}
                <form
                    onSubmit={submit}
                    className="grid min-h-0 flex-1 gap-3.5 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:gap-4 sm:p-6"
                >
                    {mode === "signup" ? (
                        <>
                            <Field icon={<User size={15} />} label="Username">
                                <input
                                    required
                                    value={form.username}
                                    onChange={e => update("username", e.target.value)}
                                    placeholder="yourname"
                                    autoComplete="username"
                                    className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                />
                            </Field>
                            <Field icon={<Mail size={15} />} label="Email">
                                <input
                                    required
                                    type="email"
                                    value={form.email}
                                    onChange={e => update("email", e.target.value)}
                                    placeholder="you@example.com"
                                    autoComplete="email"
                                    className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                />
                            </Field>
                            <Field icon={<User size={15} />} label="Full name (optional)">
                                <input
                                    value={form.fullName}
                                    onChange={e => update("fullName", e.target.value)}
                                    autoComplete="name"
                                    className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                />
                            </Field>
                            <Field icon={<Lock size={15} />} label="Password (min 6 characters)">
                                <input
                                    required
                                    type="password"
                                    minLength={6}
                                    value={form.password}
                                    onChange={e => update("password", e.target.value)}
                                    autoComplete="new-password"
                                    className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                />
                            </Field>
                        </>
                    ) : (
                        <>
                            <Field icon={<User size={15} />} label="Username or email">
                                <input
                                    required
                                    value={form.identifier}
                                    onChange={e => update("identifier", e.target.value)}
                                    placeholder="yourname"
                                    autoComplete="username"
                                    className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                />
                            </Field>
                            <Field icon={<Lock size={15} />} label="Password">
                                <input
                                    required
                                    type="password"
                                    value={form.password}
                                    onChange={e => update("password", e.target.value)}
                                    autoComplete="current-password"
                                    className="w-full rounded-xl border border-[#ddcdb8] bg-white py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#b07a4f]"
                                />
                            </Field>
                        </>
                    )}

                    {error && (
                        <div className="rounded-xl bg-[#f8e4df] px-4 py-3 text-sm text-[#8c392d]">
                            {error}
                        </div>
                    )}

                    <button
                        disabled={busy}
                        type="submit"
                        className="mt-1 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#24170f] px-6 py-3.5 text-sm font-semibold text-white transition disabled:opacity-60 hover:-translate-y-0.5 disabled:hover:translate-y-0"
                    >
                        {busy ? (
                            <>
                                <Loader2 size={15} className="animate-spin" /> Please wait…
                            </>
                        ) : mode === "signup" ? (
                            "Create account"
                        ) : (
                            "Sign in"
                        )}
                    </button>

                    <p className="text-center text-xs text-[#8a6d53]">
                        {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
                        <button
                            type="button"
                            onClick={() => {
                                setMode(mode === "signup" ? "signin" : "signup");
                                setError("");
                            }}
                            className="font-semibold text-[#7d3f24] underline"
                        >
                            {mode === "signup" ? "Sign in" : "Create account"}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}

function Field({ icon, label, children }) {
    return (
        <label className="grid gap-1.5 text-xs font-semibold text-[#5b4636]">
            {label}
            <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a38974]">
                    {icon}
                </span>
                {children}
            </div>
        </label>
    );
}