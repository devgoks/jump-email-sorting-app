"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AuthButtons() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <button
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        disabled
      >
        Loading…
      </button>
    );
  }

  if (status === "authenticated") {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Dashboard
        </Link>
        <button
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
    >
      Sign in with Google
    </button>
  );
}





