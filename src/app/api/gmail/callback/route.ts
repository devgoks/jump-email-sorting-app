import { NextResponse } from "next/server";
import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { verifyConnectGmailState } from "@/lib/oauth-state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const origin = process.env.NEXTAUTH_URL ?? url.origin;
  const dashboardUrl = new URL("/dashboard", origin);

  if (error) {
    dashboardUrl.searchParams.set("error", error);
    return NextResponse.redirect(dashboardUrl);
  }

  if (!code || !state) {
    dashboardUrl.searchParams.set("error", "missing_code_or_state");
    return NextResponse.redirect(dashboardUrl);
  }

  const verified = verifyConnectGmailState(state);
  if (!verified) {
    dashboardUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(dashboardUrl);
  }

  const redirectUri = `${origin}/api/gmail/callback`;
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const tokenRes = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokenRes.tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const me = await oauth2.userinfo.get();
  const email = me.data.email;
  const googleSub = me.data.id;

  if (!email || !googleSub) {
    dashboardUrl.searchParams.set("error", "missing_userinfo");
    return NextResponse.redirect(dashboardUrl);
  }

  const existing = await prisma.gmailAccount.findUnique({
    where: { userId_email: { userId: verified.userId, email } },
  });

  const refreshToken = tokenRes.tokens.refresh_token ?? existing?.refreshToken;
  if (!refreshToken) {
    dashboardUrl.searchParams.set("error", "missing_refresh_token");
    return NextResponse.redirect(dashboardUrl);
  }

  await prisma.gmailAccount.upsert({
    where: { userId_email: { userId: verified.userId, email } },
    update: {
      googleSub,
      refreshToken,
      accessToken: tokenRes.tokens.access_token ?? undefined,
      tokenExpiry: tokenRes.tokens.expiry_date
        ? new Date(tokenRes.tokens.expiry_date)
        : undefined,
    },
    create: {
      userId: verified.userId,
      email,
      googleSub,
      refreshToken,
      accessToken: tokenRes.tokens.access_token ?? undefined,
      tokenExpiry: tokenRes.tokens.expiry_date
        ? new Date(tokenRes.tokens.expiry_date)
        : undefined,
    },
  });

  return NextResponse.redirect(dashboardUrl);
}




