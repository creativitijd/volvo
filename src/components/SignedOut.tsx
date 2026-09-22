"use client";

import { useAccount } from "./AccountProvider";

export function SignedOut({ text }: { text: string }) {
  const { requireLogin } = useAccount();
  return (
    <div className="rounded-2xl border border-dashed border-line p-12 text-center">
      <p className="text-muted">{text}</p>
      <button
        onClick={() => requireLogin()}
        className="mt-5 rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-bg"
      >
        Inloggen
      </button>
    </div>
  );
}
