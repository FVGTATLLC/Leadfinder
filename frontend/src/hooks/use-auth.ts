"use client";

import { useSession } from "next-auth/react";
import type { UserRole } from "@/types/models";

export function useAuth() {
  const { data: session, status } = useSession();

  const user = session?.user
    ? {
        id: session.user.id as string,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        role: (session.user as Record<string, unknown>).role as UserRole,
        mustChangePassword: (session.user as Record<string, unknown>).mustChangePassword as boolean,
      }
    : null;

  const accessToken =
    (session as Record<string, unknown> | null)?.accessToken as
      | string
      | undefined;

  return {
    user,
    accessToken,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    role: user?.role ?? null,
    isAdmin: user?.role === "admin",
  };
}
