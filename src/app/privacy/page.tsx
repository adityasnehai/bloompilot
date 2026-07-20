import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white md:px-12">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-white/45">BloomPilot</p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.06em] md:text-6xl">Privacy</h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
          BloomPilot keeps your garden context, reminders, and care history connected so the product can work.
          This page can be expanded later with the full policy copy.
        </p>
        <Link href="/" className="mt-10 inline-flex text-sm font-medium text-white/80 underline underline-offset-4">
          Back home
        </Link>
      </div>
    </main>
  );
}
