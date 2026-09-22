"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

  // Favorieten laden zodra iemand ingelogd is
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !user) {
      const t = setTimeout(() => {
        setFavorites(new Set());
        setIsAdmin(false);
      }, 0);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    sb.rpc("is_admin").then(({ data }) => !cancelled && setIsAdmin(Boolean(data)));
    sb.from("favorites")
      .select("listing_id")
      .then(({ data }) => {
        if (!cancelled && data) setFavorites(new Set(data.map((r) => r.listing_id as string)));
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
        requireLogin("Log in om wagens te bewaren en ze later terug te vinden.");
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
    [favorites, user, requireLogin],
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
