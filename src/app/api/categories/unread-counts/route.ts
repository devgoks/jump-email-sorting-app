import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Body = {
  categoryIds?: string[];
  lastSeenByCategoryId?: Record<string, string | null | undefined>;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Body | null;
  const categoryIds = Array.isArray(body?.categoryIds) ? body!.categoryIds : [];
  const lastSeenByCategoryId =
    body?.lastSeenByCategoryId && typeof body.lastSeenByCategoryId === "object"
      ? body.lastSeenByCategoryId
      : {};

  if (categoryIds.length === 0) {
    return NextResponse.json({ ok: true, counts: {} });
  }

  // Ensure the requested categories belong to the user.
  const owned = await prisma.category.findMany({
    where: { userId, id: { in: categoryIds } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((c) => c.id));

  const counts: Record<string, number> = {};

  // Small N (categories) => simple loop is fine.
  for (const categoryId of categoryIds) {
    if (!ownedIds.has(categoryId)) continue;

    const raw = lastSeenByCategoryId[categoryId];
    const since = raw ? new Date(raw) : null;
    const validSince = since && !Number.isNaN(since.getTime()) ? since : null;

    counts[categoryId] = await prisma.emailMessage.count({
      where: {
        userId,
        categoryId,
        ...(validSince ? { createdAt: { gt: validSince } } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true, counts });
}


