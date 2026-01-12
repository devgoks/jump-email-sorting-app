import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncUserInboxes } from "@/lib/sync";
import { CategoryCards } from "@/components/category-cards";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const [gmailAccounts, categories] = await Promise.all([
    prisma.gmailAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  async function createCategory(formData: FormData) {
    "use server";
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!name || !description) return;

    await prisma.category.create({
      data: { userId, name, description },
    });

    revalidatePath("/dashboard");
  }

  async function syncNow() {
    "use server";
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    await syncUserInboxes(userId, { maxPerInbox: 10 });
    revalidatePath("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Connected inboxes, categories, and new email ingestion.
            </p>
          </div>
          <Link
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 hover:text-zinc-950"
            href="/api/auth/signout?callbackUrl=/"
          >
            Sign out
          </Link>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-base font-semibold text-zinc-950">
              Connected Gmail inboxes
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              You can connect multiple Gmail accounts to sort across inboxes.
            </p>
            <div className="mt-4 space-y-2">
              {gmailAccounts.length === 0 ? (
                <div className="text-sm text-zinc-600">
                  No inbox connected yet. Sign in again with Google to grant
                  Gmail access.
                </div>
              ) : (
                gmailAccounts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-800"
                  >
                    {a.email}
                    {a.lastSyncedAt ? (
                      <span className="ml-2 text-xs text-zinc-500">
                        (last sync {a.lastSyncedAt.toISOString()})
                      </span>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <Link
                href="/api/gmail/connect"
                className="inline-flex w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 hover:text-zinc-950"
              >
                Connect another Gmail inbox
              </Link>
            </div>

            {/* <form action={syncNow} className="mt-4">
              <button className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                Sync now (import + archive)
              </button>
              <p className="mt-2 text-xs text-zinc-500">
                This imports up to 10 inbox emails per connected account, uses
                AI to classify + summarize, then archives in Gmail.
              </p>
            </form> */}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">
                  Categories
                </h2>
                <p className="mt-1 text-xs text-zinc-600">
                  AI will use your category descriptions to classify new emails.
                </p>
              </div>
            </div>

            <CategoryCards
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
              }))}
            />

            <div className="mt-8 border-t border-zinc-200 pt-6">
              <h3 className="text-base font-semibold text-zinc-950">
                Add a new category
              </h3>
              <form action={createCategory} className="mt-3 grid gap-3">
                <input
                  name="name"
                  placeholder="Category name (e.g. Bills, Work, Promotions)"
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
                  required
                />
                <textarea
                  name="description"
                  placeholder="Description used by AI to classify emails into this category..."
                  className="min-h-[96px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
                  required
                />
                <div>
                  <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
                    Create category
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


