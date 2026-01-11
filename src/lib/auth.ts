import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * For this challenge we request Gmail scopes at sign-in so the signed-in Google
 * account can immediately be used as a connected inbox.
 *
 * Scopes:
 * - gmail.modify: read + archive + trash + labels
 * - userinfo.email/profile: basic identity
 */
const googleScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Fixes OAuthAccountNotLinked when a user row exists for the same email
      // but the Account row wasn't created (e.g. a previous sign-in crashed mid-flow).
      // This is acceptable for this dev-only challenge app.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: googleScopes,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (!account || account.provider !== "google") return;
      if (!account.refresh_token) return;

      const email =
        (profile as { email?: string } | undefined)?.email ??
        user.email ??
        undefined;
      const googleSub =
        (profile as { sub?: string } | undefined)?.sub ??
        account.providerAccountId;

      if (!email) return;

      await prisma.gmailAccount.upsert({
        where: { userId_email: { userId: user.id, email } },
        update: {
          googleSub,
          refreshToken: account.refresh_token,
          accessToken: account.access_token ?? undefined,
          tokenExpiry: account.expires_at
            ? new Date(account.expires_at * 1000)
            : undefined,
        },
        create: {
          userId: user.id,
          email,
          googleSub,
          refreshToken: account.refresh_token,
          accessToken: account.access_token ?? undefined,
          tokenExpiry: account.expires_at
            ? new Date(account.expires_at * 1000)
            : undefined,
        },
      });
    },
  },
};

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}


