"use client";

import { useState } from "react";
import { accountsEnabled, getSupabase } from "@/lib/supabase";
import { Modal } from "./Modal";

/** Inloggen/registreren in één stap: e-mailadres ingeven → link in je mailbox. */
export function LoginDialog({ reason, onClose }: { reason: string; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setState("sending");
    setError(null);
    const next = window.location.pathname + window.location.search;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState("idle");
      setError(
        error.status === 429 ? "Even geduld: je vroeg net al een link aan. Probeer het over een minuutje opnieuw." : "Versturen lukte niet. Controleer je e-mailadres.",
      );
    } else {
      setState("sent");
    }
  }

  return (
    <Modal title={state === "sent" ? "Check je mailbox" : "Inloggen of account maken"} onClose={onClose}>
      {!accountsEnabled ? (
        <p className="text-sm text-muted">Accounts zijn nog niet geactiveerd op deze site.</p>
      ) : state === "sent" ? (
        <div className="space-y-3 text-sm">
          <p>
            We stuurden een inloglink naar <strong>{email}</strong>. Klik op de link in die mail om in te loggen. Open hem in
            deze browser.
          </p>
          <p className="text-muted">Niets gekregen? Kijk even in je spam of ongewenste mail.</p>
          <button onClick={onClose} className="mt-2 w-full rounded-md bg-ink px-4 py-2.5 font-medium text-bg">
            OK
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {reason && <p className="text-sm text-muted">{reason}</p>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">E-mailadres</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@voorbeeld.be"
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 outline-none focus:border-ink"
            />
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={state === "sending"}
            className="w-full rounded-md bg-ink px-4 py-2.5 font-medium text-bg disabled:opacity-50"
          >
            {state === "sending" ? "Versturen…" : "Stuur me een inloglink"}
          </button>
          <p className="text-xs text-muted">
            Geen wachtwoord nodig. Nog geen account? Dan maken we er automatisch een aan.
          </p>
        </form>
      )}
    </Modal>
  );
}
