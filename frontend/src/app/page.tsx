import Link from "next/link";

export default function Home() {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center bg-clause-bg p-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-clause-text">
        ClauseAI
      </h1>
      <p className="mt-2 text-sm text-clause-text2">
        AI infrastructure intelligence for startups
      </p>
      <Link
        href="/onboarding"
        className="mt-6 rounded-lg bg-clause-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--clause-accent-hover)]"
      >
        Start ClauseAI Onboarding
      </Link>
    </main>
  );
}

