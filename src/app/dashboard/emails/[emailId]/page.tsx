import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ emailId: string }>;
}) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) redirect("/");

  const { emailId } = await params;

  const email = await prisma.emailMessage.findFirst({
    where: { id: emailId, userId },
    include: { category: true, gmailAccount: true },
  });

  if (!email) notFound();

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-start justify-between gap-6">
          <div>
            <Link
              href={`/dashboard/categories/${email.categoryId}`}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              ← Back to {email.category.name}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900">
              {email.subject ?? "(no subject)"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              From: {email.fromEmail ?? "unknown"} · Inbox:{" "}
              {email.gmailAccount.email}
            </p>
          </div>
        </header>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">AI Summary</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
            {email.summary ?? "(not summarized yet)"}
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-zinc-900">
            Original contents
          </h2>
          {email.bodyHtml ? (
            <div
              className="prose prose-zinc mt-4 max-w-none"
              dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
            />
          ) : (
            <pre className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-800">
              {email.bodyText ?? email.snippet ?? ""}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}


