"use client";
import * as React from "react";
import type { User } from "@/lib/client/types";

const Ctx = React.createContext<{ user: User; setUser: (u: User) => void } | null>(null);

export function UserProvider({ initial, children }: { initial: User; children: React.ReactNode }) {
  const [user, setUser] = React.useState(initial);
  return <Ctx.Provider value={{ user, setUser }}>{children}</Ctx.Provider>;
}

export function useUser() {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useUser must be used inside UserProvider");
  return v;
}
