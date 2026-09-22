"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import type { Card } from "@/lib/card";
import { LoginDialog } from "./LoginDialog";

interface AccountContext {
  user: User | null;
  ready: boolean;
  isAdmin: boolean;
  favorites: Set<string>;
  toggleFavorite: (card: Card) => Promise<void>;
  /** Opent het loginvenster; `reason` legt uit waarom inloggen nodig is */
  requireLogin: (reason?: string) => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountContext | null>(null);
const GUEST_KEY = "vev-guest-favorites";

function readGuest(): Card[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c): c is Card => Boolean(c) && typeof c === "object" && typeof (c as Card).id === "string");
  } catch {
    return [];
  }
}

function writeGuest(cards: Card[]) {
  try {
    if (cards.length === 0) localStorage.removeItem(GUEST_KEY);
    else localStorage.setItem(GUEST_KEY, JSON.stringify(cards));
  } catch {
    // Opslag kan geblokkeerd zijn; de selectie blijft dan in dit tabblad.
  }
}

export function useAccount() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount buiten AccountProvider");
  return ctx;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginReason, setLoginReason] = useState<string | null>(null);
  const guestRef = useRef<Card[]>([]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      const t = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(t);
    }
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // Zonder account blijft de selectie lokaal. Na inloggen gaat ze naar het account.
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) {
      const cards = readGuest();
      guestRef.current = cards;
      const t = setTimeout(() => {
        setFavorites(new Set(cards.map((c) => c.id)));
        setIsAdmin(false);
      }, 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    sb.rpc("is_admin").then(({ data }) => !cancelled && setIsAdmin(Boolean(data)));
    const pending = readGuest();
    sb.from("favorites")
      .select("listing_id")
      .then(async ({ data, error }) => {
        if (cancelled || error) return;
        const ids = new Set((data ?? []).map((r) => r.listing_id as string));
        for (const card of pending) {
          if (ids.has(card.id)) continue;
          const { error } = await sb.from("favorites").insert({ user_id: user.id, listing_id: card.id, snapshot: card });
          if (!error) ids.add(card.id);
        }
        if (!cancelled) {
          writeGuest([]);
          guestRef.current = [];
          setFavorites(ids);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const requireLogin = useCallback((reason?: string) => setLoginReason(reason ?? ""), []);

  const toggleFavorite = useCallback(
    async (card: Card) => {
      const sb = getSupabase();
      if (!sb || !user) {
        const liked = guestRef.current.some((c) => c.id === card.id);
        const next = liked ? guestRef.current.filter((c) => c.id !== card.id) : [card, ...guestRef.current.filter((c) => c.id !== card.id)];
        guestRef.current = next;
        writeGuest(next);
        setFavorites(new Set(next.map((c) => c.id)));
        return;
      }
      const liked = favorites.has(card.id);
      // Optimistisch bijwerken, terugdraaien bij een fout
      setFavorites((prev) => {
        const next = new Set(prev);
        if (liked) next.delete(card.id);
        else next.add(card.id);
        return next;
      });
      const { error } = liked
        ? await sb.from("favorites").delete().eq("listing_id", card.id)
        : await sb.from("favorites").insert({ user_id: user.id, listing_id: card.id, snapshot: card });
      if (error) {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (liked) next.add(card.id);
          else next.delete(card.id);
          return next;
        });
      }
    },
    [favorites, user],
  );

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, ready, isAdmin, favorites, toggleFavorite, requireLogin, signOut }),
    [user, ready, isAdmin, favorites, toggleFavorite, requireLogin, signOut],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {loginReason !== null && <LoginDialog reason={loginReason} onClose={() => setLoginReason(null)} />}
    </Ctx.Provider>
  );
}
