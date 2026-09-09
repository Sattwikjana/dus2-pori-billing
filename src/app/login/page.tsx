"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck, User } from "lucide-react";
import { BrandLogo } from "@/components/Brand";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not sign in. Please try again.");
        setBusy(false);
        return;
      }
      const next = params.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Network problem. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-ink-100 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-plum-950 p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-500/25 blur-3xl" />

        <div className="relative">
          <BrandLogo width={230} priority />
        </div>

        <div className="relative">
          <h1 className="display max-w-md text-[40px] leading-[1.1] text-white">
            Bill in seconds.
            <br />
            <span className="bg-gradient-to-r from-brand-400 to-gold-400 bg-clip-text text-transparent">
              Keep customers coming back.
            </span>
          </h1>
          <ul className="mt-8 space-y-3">
            {[
              "Find any old customer by 4–5 digits of their mobile",
              "GST-ready invoices, print or send on WhatsApp",
              "Loyalty points, stock alerts and daily reports",
              "Works without internet — and syncs the moment it returns",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-brand-100">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-300/60">
          © {new Date().getFullYear()} Dus2 PORI. Built for the shop, not the cloud.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandLogo width={168} priority />
          </div>

          <h2 className="display text-[26px] text-ink-900">
            Sign in to your shop
          </h2>
          <div className="gold-rule mt-2.5" />
          <p className="mt-1.5 text-sm text-ink-500">
            Only you can open this billing system.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="username"
                  name="username"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="field h-12 pl-10"
                  placeholder="Your username"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-400"
                />
                <input
                  id="password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field h-12 pr-11 pl-10"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="animate-pop rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-brand-500 to-brand-600 text-sm font-bold text-white shadow-sm shadow-brand-600/30 transition hover:from-brand-600 hover:to-brand-700 disabled:cursor-not-allowed disabled:from-brand-300 disabled:to-brand-300 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-8 flex items-start gap-2.5 rounded-2xl bg-ink-100 p-3.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand-600" />
            <p className="text-[11px] leading-relaxed text-ink-600">
              Your shop data is stored privately for this shop alone, and every
              page is behind this login.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
