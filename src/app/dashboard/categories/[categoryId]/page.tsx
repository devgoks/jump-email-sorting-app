import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryEmailList } from "@/components/category-email-list";
import { MarkCategorySeen } from "@/components/mark-category-seen";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const { categoryId } = await params;

  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
  });
  if (!category) notFound();

  const emails = await prisma.emailMessage.findMany({
    where: { userId, categoryId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const items = emails.map((e) => ({
    id: e.id,
    subject: e.subject,
    fromEmail: e.fromEmail,
    createdAtIso: e.createdAt.toISOString(),
    summary: e.summary,
    snippet: e.snippet,
    importStatus: e.importStatus,
  }));

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <MarkCategorySeen categoryId={categoryId} />
        <header className="flex items-start justify-between gap-6">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-base font-semibold text-zinc-700 hover:text-zinc-950"
            >
              ← Back To Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
              {category.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">{category.description}</p>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Imported emails
            </h2>
            <div className="text-xs text-zinc-500">
              Showing {emails.length} (max 200)
            </div>
          </div>

          {emails.length === 0 ? (
            <div className="mt-4 py-6 text-sm text-zinc-600">
              No emails imported into this category yet.
            </div>
          ) : (
            <div className="mt-4">
              <CategoryEmailList items={items} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


