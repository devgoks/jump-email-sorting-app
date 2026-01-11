import { AuthButtons } from "@/components/auth-buttons";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-600">
              Jump Challenge
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              AI Email Sorting
            </h1>
          </div>
          <AuthButtons />
        </header>

        <main className="rounded-2xl border border-zinc-200 bg-white p-8">
          <h2 className="text-lg font-semibold text-zinc-900">
            What this app does
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Connect Gmail, define categories with descriptions, and the app will
            use AI to sort new emails into categories, summarize them, and
            archive them in Gmail. You can browse by category and take bulk
            actions like delete or unsubscribe.
          </p>

          <div className="mt-6">
            <AuthButtons />
          </div>
        </main>
      </div>
    </div>
  );
}
