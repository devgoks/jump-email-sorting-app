import crypto from "crypto";

type StatePayload = {
  v: 1;
  purpose: "connect-gmail";
  userId: string;
  iat: number;
};

function base64UrlEncode(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(str: string) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, "base64");
}

export function signConnectGmailState(userId: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required");

  const payload: StatePayload = {
    v: 1,
    purpose: "connect-gmail",
    userId,
    iat: Math.floor(Date.now() / 1000),
  };

  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

export function verifyConnectGmailState(state: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required");

  const [payloadB64, sigB64] = state.split(".");
  if (!payloadB64 || !sigB64) return null;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest();
  let providedSig: Buffer;
  try {
    providedSig = base64UrlDecode(sigB64);
  } catch {
    return null;
  }
  if (providedSig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8")) as StatePayload;
    if (payload.v !== 1 || payload.purpose !== "connect-gmail") return null;
    const now = Math.floor(Date.now() / 1000);
    if (now - payload.iat > 10 * 60) return null; // 10 min expiry
    return payload;
  } catch {
    return null;
  }
}


