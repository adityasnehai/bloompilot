import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white md:px-12">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-white/45">BloomPilot</p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-0.06em] md:text-6xl">Terms</h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-white/68 md:text-base">
          BloomPilot is a product in active development. These terms can be expanded as the app and its workflows
          settle into final product use.
        </p>
        <Link href="/" className="mt-10 inline-flex text-sm font-medium text-white/80 underline underline-offset-4">
          Back home
        </Link>
      </div>
    </main>
  );
}
