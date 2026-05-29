import Link from "next/link";
import { redirect } from "next/navigation";
import { DiagnosisScanner } from "@/components/home/diagnosis-scanner";
import { readSession } from "@/lib/session";
import { HeroVideo } from "@/components/home/hero-video";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260228_065522_522e2295-ba22-457e-8fdb-fbcd68109c73.mp4";

const workflowItems = [
  ["Set garden context", "Save location, garden type, and reminder window so care matches the environment you actually have."],
  ["Build your plant list", "Add plants by name or photo and track placement, sunlight, and notes per plant."],
  ["Use weather-aware planning", "Daily actions adjust using temperature, humidity, rain, and UV instead of fixed schedules."],
  ["Work from today’s queue", "See what to water, delay, move, inspect, or protect right now."],
  ["Run plant diagnosis", "Upload a photo, identify the issue, and convert it into follow-up care actions."],
  ["See evidence behind actions", "Recommendations stay grounded in plant identity, garden setup, and live context."],
] as const;

const reminderBullets = [
  "Timed perfectly to weather & plant stage",
  "Snooze, reschedule or skip in one tap",
  "Multi-garden support for plant collectors",
  "Quiet hours & timezone-aware",
] as const;

const audienceCards = [
  ["Indoor", "Low-light plants, shelf collections, and room-by-room care."],
  ["Balcony", "Wind, direct sun, containers, and fast seasonal shifts."],
  ["Terrace", "Heat stress, rooftop exposure, drainage, and edible growing."],
  ["Backyard", "Beds, shrubs, kitchen gardens, and weather-aware planning."],
] as const;

const trustItems = [
  ["Open-Meteo", "Weather context"],
  ["PlantNet", "Plant identification"],
  ["Diagnosis", "Photo-based health checks"],
  ["WhatsApp", "Reminder delivery"],
  ["Email", "Digest and nudges"],
  ["Push", "Fast action alerts"],
] as const;

const faqs = [
  [
    "How does BloomPilot personalise my plant care?",
    "After signup, BloomPilot combines your location, local climate, and the garden context you share to build a personalised daily care profile for each plant.",
    true,
  ],
  [
    "Do I need a paid plan to use WhatsApp reminders?",
    "Not for the product setup flow. Reminder channels are being rolled out in phases, so you can start with dashboard-based care actions and enable delivery options later.",
    false,
  ],
  [
    "Can BloomPilot identify plant diseases from a photo?",
    "Yes. You can upload a plant photo to run diagnosis and use that result to update care actions, inspections, and next-step treatment guidance.",
    false,
  ],
  [
    "Is my plant and location data private?",
    "Your garden context is used to personalise care recommendations. Account, plant, and environment data stay tied to your workspace rather than being exposed publicly.",
    false,
  ],
  [
    "Can I manage multiple gardens?",
    "Yes. BloomPilot is designed to support more than one setup, so you can manage indoor collections, balconies, terraces, or separate garden spaces over time.",
    false,
  ],
] as const;

function SectionAccent() {
  return (
    <div className="mb-4 flex items-center justify-center gap-3">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#9cc9ab]" />
      <span className="h-px w-16 bg-gradient-to-r from-[#9cc9ab] to-[#f0c7a8]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#f0c7a8]" />
    </div>
  );
}

function MockAvatar({ variant }: { variant: "ananya" | "arjun" | "priya" }) {
  const palette =
    variant === "ananya"
      ? {
          bg: "#daf3df",
          hair: "#253a31",
          skin: "#d7a37f",
          shirt: "#24a34d",
        }
      : variant === "arjun"
        ? {
            bg: "#ffe6d4",
            hair: "#2f2722",
            skin: "#d6a17c",
            shirt: "#ff934f",
          }
        : {
            bg: "#dff2fb",
            hair: "#352821",
            skin: "#d9a27f",
            shirt: "#18b1dc",
          };

  return (
    <span
      className="inline-flex h-[56px] w-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 shadow-[0_10px_22px_rgba(20,52,39,0.12)]"
      style={{ background: palette.bg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 56 56" className="h-full w-full">
        <rect width="56" height="56" fill={palette.bg} />
        <circle cx="28" cy="58" r="18" fill={palette.shirt} />
        <circle cx="28" cy="24" r="10.5" fill={palette.skin} />
        <path
          d={
            variant === "ananya"
              ? "M17 23c0-8 5-13 11-13s11 5 11 13v2c-1-2-3-3-5-3-3 0-5-2-6-4-2 3-5 5-8 5-1 0-2 0-3-.4z"
              : variant === "arjun"
                ? "M17 22c1-7 6-12 11-12 7 0 11 6 11 13-3-2-7-3-11-3-4 0-8 1-11 2z"
                : "M16 23c1-8 6-13 12-13 7 0 12 5 12 13-2-2-4-3-7-3-3 0-6-1-8-3-2 3-5 4-9 4z"
          }
          fill={palette.hair}
        />
        <circle cx="24" cy="24" r="0.9" fill="#2d241f" />
        <circle cx="32" cy="24" r="0.9" fill="#2d241f" />
        <path d="M24 29c1.2 1.2 6.8 1.2 8 0" stroke="#9b5f46" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default async function HomePage() {
  const session = await readSession();
  if (session) redirect(session.onboarded ? "/dashboard" : "/preferences");

  return (
    <div className="landing-root">
      <header className="fixed inset-x-0 top-0 z-20 px-4 py-3 md:px-5">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between rounded-xl border border-white/20 bg-black/22 px-4 py-2.5 backdrop-blur-md md:px-5">
          <Link href="/" className="font-accent text-base font-semibold text-white md:text-lg">
            BloomPilot
          </Link>
          <div className="font-accent hidden items-center gap-6 text-[14px] font-medium text-white/85 md:flex">
            <a href="#features">Product</a>
            <a href="#reminders">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQ</a>
          </div>
          <Link href="/sign-up" className="font-accent inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)] px-3.5 py-2 text-xs text-white md:px-4 md:text-sm">
            Get started
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] md:h-6 md:w-6 md:text-xs">↗</span>
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative h-screen w-full overflow-hidden">
          <div className="absolute inset-0 z-0">
            <HeroVideo src={HERO_VIDEO} />
          </div>
          <div className="relative z-10 flex h-full -translate-y-8 flex-col items-center justify-center px-5 pt-28 text-center md:-translate-y-12 md:px-6 md:pt-24">
            <h1 className="hero-heading-main max-w-5xl">
              Your garden, thriving
            </h1>
            <h2 className="hero-heading-sub mt-1">
              on autopilot
            </h2>
            <p className="font-accent mt-5 max-w-2xl rounded-xl bg-white/68 px-4 py-2.5 text-[15px] leading-6 text-[#26493b] md:max-w-3xl md:px-5 md:text-[17px] md:leading-7">
              BloomPilot turns your location, weather, and plant setup into clear daily care actions.
            </p>
            <div className="mt-7 flex w-full max-w-sm flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row">
              <Link href="/sign-up" className="font-accent inline-flex w-full items-center justify-center rounded-full bg-[#173528] px-8 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(23,53,40,0.22)] sm:w-auto">
                Create account
              </Link>
              <Link href="/sign-in" className="font-accent inline-flex w-full items-center justify-center rounded-full border border-white/60 bg-white/34 px-8 py-3 text-sm font-semibold text-[#173528] backdrop-blur-sm sm:w-auto">
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <div className="landing-flow">
        <section id="features" className="landing-section landing-section-soft scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-3xl text-center">
              <SectionAccent />
              <span className="landing-pill">
                Product Workflow
              </span>
              <h2 className="landing-heading mt-4 text-[2.6rem] md:text-[4rem]">
                Everything needed for <span className="text-[#566e2e]">daily plant care</span>
              </h2>
              <p className="landing-copy mt-4 text-base md:text-lg">
                BloomPilot is structured around one workflow: set context, add plants, follow daily actions, and keep care consistent.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {workflowItems.map(([title, desc]) => (
                <article key={title} className="landing-card group rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(17,47,35,0.08)]">
                  <h3 className="font-accent text-lg font-semibold text-[#163629]">
                    {title}
                  </h3>
                  <p className="landing-copy mt-2 text-sm leading-7">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="how-it-works" className="landing-section landing-section-sage scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <SectionAccent />
              <span className="landing-pill border-0 bg-[#eaf3db] text-[#566e2e]">
                How It Works
              </span>
              <h2 className="landing-heading mt-5 text-[2.7rem] md:text-[4rem]">
                From setup to <span className="text-[#78962d]">daily care</span> in four steps
              </h2>
            </div>

            <div className="relative mt-14">
              <div className="absolute left-[14%] right-[14%] top-12 hidden border-t-2 border-dashed border-[#b8d9bf] lg:block" />
              <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
                {[
                  [
                    "1",
                    "Create your account",
                    "Sign up in seconds and create your plant-care workspace.",
                    (
                      <svg key="step-account" viewBox="0 0 24 24" className="h-8 w-8 text-[#07844f]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="10" cy="7" r="4" />
                        <path d="M20 8v6" />
                        <path d="M23 11h-6" />
                      </svg>
                    ),
                  ],
                  [
                    "2",
                    "Share location & garden",
                    "Tell us where you live and what your garden looks like so the app can personalize care.",
                    (
                      <svg key="step-location" viewBox="0 0 24 24" className="h-8 w-8 text-[#07844f]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 10c0 6-9 11-9 11S3 16 3 10a9 9 0 1 1 18 0Z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    ),
                  ],
                  [
                    "3",
                    "Get your dashboard",
                    "Receive a personalised plant list, care plan, and daily recommendations from your system.",
                    (
                      <svg key="step-dashboard" viewBox="0 0 24 24" className="h-8 w-8 text-[#07844f]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="7" height="7" rx="1.5" />
                        <rect x="14" y="3" width="7" height="7" rx="1.5" />
                        <rect x="3" y="14" width="7" height="7" rx="1.5" />
                        <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      </svg>
                    ),
                  ],
                  [
                    "4",
                    "Set up reminders",
                    "Pick WhatsApp, push, or email so BloomPilot nudges you at the right moment.",
                    (
                      <svg key="step-reminders" viewBox="0 0 24 24" className="h-8 w-8 text-[#07844f]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M10.27 21a2 2 0 0 0 3.46 0" />
                        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                      </svg>
                    ),
                  ],
                ].map(([step, title, desc, icon], idx) => (
                  <article
                    key={`${step}-${idx}`}
                    className="animate-fade-rise relative text-center"
                    style={{ animationDelay: `${idx * 120}ms` }}
                  >
                    <div className="relative mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[28px] border border-[#d9dfd5] bg-white shadow-[0_12px_28px_rgba(110,153,118,0.1)]">
                      {icon}
                      <span className="absolute -right-1 -top-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#17a34a] text-xs font-semibold text-white shadow-[0_8px_18px_rgba(23,163,74,0.22)]">
                        {step}
                      </span>
                    </div>
                    <h3 className="landing-heading mt-6 text-[1.55rem] leading-[1.12]">
                      {title}
                    </h3>
                    <p className="landing-copy mx-auto mt-3 max-w-[240px] text-[14px] leading-7">
                      {desc}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="dashboard-preview" className="landing-section scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <SectionAccent />
              <span className="landing-pill">Dashboard preview</span>
              <h2 className="landing-heading mt-5 text-[2.7rem] md:text-[4rem]">
                A dashboard that makes <span className="text-[var(--color-video-olive)]">today&apos;s care obvious</span>
              </h2>
              <p className="landing-copy mx-auto mt-4 max-w-3xl text-base md:text-lg">
                See what to do, why it matters, and how weather changes the plan before you open the garden.
              </p>
            </div>

            <div className="mt-14 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
              <article className="landing-card h-full overflow-hidden rounded-[30px] p-6 md:p-7">
                <div className="flex items-center justify-between border-b border-[#e2ebe1] pb-4">
                  <div>
                    <p className="font-accent text-sm font-semibold text-[#163629]">Today&apos;s care dashboard</p>
                    <p className="mt-1 text-sm text-[#6a7e73]">Action queue, weather context, and plant readiness.</p>
                  </div>
                  <span className="landing-pill border-0 bg-[#edf4e7] text-[var(--color-video-olive)]">Live context</span>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr] md:items-stretch">
                  <div className="rounded-[24px] border border-[#deeadf] bg-[linear-gradient(180deg,#ffffff_0%,#f5faf3_100%)] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-accent text-sm font-semibold text-[#173528]">Today&apos;s actions</p>
                        <p className="mt-1 text-sm text-[#708479]">3 tasks need attention now.</p>
                      </div>
                      <span className="rounded-full bg-[#173528] px-3 py-1 text-xs font-semibold text-white">Priority</span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {[
                        ["Water Monstera", "Humidity dropped to 41%", "var(--color-canopy)"],
                        ["Move basil to shade", "High UV expected at 2 PM", "var(--color-video-olive)"],
                        ["Inspect rose leaves", "Recent diagnosis follow-up", "var(--color-video-leaf)"],
                      ].map(([title, reason, dot]) => (
                        <div key={title} className="flex items-start gap-3 rounded-2xl border border-[#e3ece3] bg-white px-4 py-3">
                          <span className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dot }} />
                          <div>
                            <p className="font-accent text-sm font-semibold text-[#163629]">{title}</p>
                            <p className="mt-1 text-sm text-[#698073]">{reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex h-full flex-col gap-4">
                    <div className="flex-1 rounded-[24px] border border-[#deeadf] bg-white p-5">
                      <p className="font-accent text-sm font-semibold text-[#163629]">Weather context</p>
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <p className="text-4xl font-semibold text-[#203016]">31°</p>
                          <p className="mt-1 text-sm text-[#6d8276]">Humidity 64% · UV 7</p>
                        </div>
                        <span className="rounded-full bg-[#eef4e4] px-3 py-1 text-xs font-semibold text-[#566e2e]">Heat risk</span>
                      </div>
                    </div>
                    <div className="flex-1 rounded-[24px] border border-[#deeadf] bg-white p-5">
                      <p className="font-accent text-sm font-semibold text-[#163629]">Collection snapshot</p>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {[
                          ["12", "Plants"],
                          ["4", "Due today"],
                          ["92%", "Ready"],
                        ].map(([value, label]) => (
                          <div key={label} className="rounded-2xl bg-[#f4f8f2] px-3 py-4 text-center">
                            <p className="font-accent text-lg font-semibold text-[#173528]">{value}</p>
                            <p className="mt-1 text-xs text-[#6f8377]">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <div className="flex h-full flex-col gap-4">
                <article className="landing-subtle-card rounded-[28px] p-6">
                  <p className="font-accent text-sm font-semibold text-[var(--color-ink)]">What becomes clear fast</p>
                  <div className="mt-5 space-y-3">
                    {[
                      "What needs watering, moving, or inspecting today",
                      "How weather changes the next action",
                      "Which plants are healthy and which need attention",
                    ].map((item) => (
                      <div key={item} className="flex gap-3">
                        <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-video-leaf)]" />
                        <p className="text-sm leading-7 text-[var(--color-muted)]">{item}</p>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="landing-subtle-card flex-1 rounded-[28px] p-6">
                  <p className="font-accent text-sm font-semibold text-[var(--color-ink)]">What you get each day</p>
                  <div className="mt-4 space-y-3">
                    {[
                      "A prioritized action queue with clear next steps",
                      "Weather-aware adjustments before overwatering happens",
                      "Plant-level follow-ups after every diagnosis",
                    ].map((item) => (
                      <div key={item} className="flex gap-3">
                        <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-video-leaf)]" />
                        <p className="text-sm leading-7 text-[var(--color-muted)]">{item}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="diagnosis-preview" className="landing-section scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <SectionAccent />
              <span className="landing-pill">Plant diagnosis</span>
              <h2 className="landing-heading mt-5 text-[2.7rem] md:text-[4rem]">
                From stressed leaf to <span className="text-[var(--color-video-olive)]">clear action plan</span>
              </h2>
              <p className="landing-copy mx-auto mt-4 max-w-3xl text-base md:text-lg">
                Run a scan, identify the issue, and feed the result straight into the next care actions.
              </p>
            </div>

            <div className="mx-auto mt-14 max-w-6xl">
              <div className="relative rounded-[36px] border border-[#dce7da] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,248,241,0.92)_100%)] px-5 py-5 shadow-[0_18px_40px_rgba(48,65,22,0.08)] md:px-8 md:py-8">
                <div className="pointer-events-none absolute left-8 top-8 h-24 w-24 rounded-full bg-[#dff0d4]/60 blur-3xl" />
                <div className="pointer-events-none absolute bottom-10 right-10 h-28 w-28 rounded-full bg-[#eef4e4]/80 blur-3xl" />

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:gap-8">
                  <div className="mx-auto w-full max-w-[760px]">
                    <div className="rounded-[28px] bg-[radial-gradient(circle_at_top_left,#d7efcf_0%,#a8c0b4_38%,#748f68_100%)] p-3 md:p-4">
                      <DiagnosisScanner infectedSrc="/infected.png" healthySrc="/healthy.png" />
                    </div>
                  </div>

                  <article className="landing-subtle-card relative mx-auto w-full max-w-[340px] rounded-[28px] p-5 md:p-6 lg:mx-0">
                    <div className="pointer-events-none absolute -left-8 top-1/2 hidden h-px w-8 -translate-y-1/2 border-t-2 border-dashed border-[#8eb899] lg:block" />
                    <div className="pointer-events-none absolute -left-[9px] top-1/2 hidden h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#78962d] shadow-[0_0_0_6px_rgba(120,150,45,0.14)] lg:block" />

                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-accent text-xs font-semibold uppercase tracking-[0.14em] text-[#6a825f]">
                          Diagnosis output
                        </p>
                        <p className="mt-2 font-accent text-xl font-semibold text-[#173528]">
                          Early fungal leaf spot
                        </p>
                        <p className="mt-1 text-sm text-[#6a7e73]">Confidence 87% · Care queue updated</p>
                      </div>
                      <span className="rounded-full bg-[#eef4e4] px-3 py-1 text-xs font-semibold text-[#566e2e]">Ready</span>
                    </div>

                    <div className="mt-5 space-y-3">
                      {[
                        "Reduce leaf wetness for the next 3 days",
                        "Inspect lower leaves again tomorrow morning",
                        "Add a follow-up check to the dashboard",
                      ].map((item) => (
                        <div key={item} className="flex gap-3 rounded-2xl bg-[#f4f8f2] px-4 py-3">
                          <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#78962d]" />
                          <p className="text-sm leading-7 text-[#5d7367]">{item}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {["Leaf moisture", "Airflow", "Recheck"].map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-[#dbe6d8] bg-white px-3 py-1 text-xs font-semibold text-[#5f7568]"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="reminders" className="landing-section landing-section-sage scroll-mt-24">
          <div className="relative mx-auto grid w-full max-w-7xl gap-12 overflow-hidden px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="pointer-events-none absolute -left-12 top-16 h-40 w-40 rounded-full bg-[#c8f0d3]/40 blur-3xl" />
            <div className="pointer-events-none absolute bottom-10 right-10 h-44 w-44 rounded-full bg-[#ffe4cf]/45 blur-3xl" />
            <div>
              <SectionAccent />
              <span className="landing-pill border-0 bg-[#eef4e4] text-[#566e2e]">
                Reminders, your way
              </span>
              <h2 className="landing-heading mt-6 max-w-[560px] text-[2.7rem] md:text-[4rem]">
                Gentle nudges on every channel you <span className="text-[#78962d]">actually use</span>
              </h2>
              <p className="landing-copy mt-6 max-w-[520px] text-[16px] md:text-[17px]">
                Choose one or all three. BloomPilot keeps your plants happy without spamming your day.
              </p>

              <div className="mt-10 space-y-5">
                {reminderBullets.map((item) => (
                  <div key={item} className="flex items-start gap-4">
                    <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#16a34a] text-[15px] text-white shadow-[0_8px_18px_rgba(22,163,74,0.18)]">
                      ✓
                    </span>
                    <p className="font-accent text-[15px] leading-8 text-[#163629]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5 pt-7">
              {[
                [
                  "WhatsApp · BloomPilot",
                  "7:02 AM",
                  "🌿 Good morning! Your Monstera needs a light misting today — humidity dropped to 41%.",
                  "#86efac",
                  "whatsapp",
                ],
                [
                  "Push · BloomPilot App",
                  "just now",
                  "🪴 Water your Tomato plants in 30 min — rain expected this evening, skip tomorrow's schedule.",
                  "#22c55e",
                  "push",
                ],
                [
                  "Email · Weekly digest",
                  "Sun 9:00 AM",
                  "📬 This week in your garden: 2 plants due for repotting, 1 pest alert, 4 new recommendations.",
                  "#fcd27a",
                  "email",
                ],
              ].map(([title, time, message, color, icon], idx) => (
                <article
                  key={`${title}-${idx}`}
                  className={`landing-subtle-card animate-fade-rise relative rounded-[28px] px-5 py-5 ${idx === 0 ? "-rotate-[1deg]" : idx === 1 ? "rotate-[0.8deg]" : "-rotate-[0.6deg]"}`}
                  style={{ animationDelay: `${idx * 120}ms` }}
                >
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
                  <div className="flex items-start gap-4">
                    <span
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#13422f] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                      style={{ backgroundColor: `${color}` }}
                    >
                      {icon === "whatsapp" ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 11.5A8.5 8.5 0 0 1 7.4 19l-3.4 1 1.1-3.2A8.5 8.5 0 1 1 20 11.5Z" />
                          <path d="M9.4 8.9c.2-.5.4-.5.8-.5h.6c.2 0 .5 0 .7.5.3.7 1 2.3 1.1 2.4.1.2.1.4 0 .6l-.5.6c-.2.2-.3.3-.1.6.2.3.8 1.4 1.9 2.2 1.3 1 2.3 1.3 2.7 1.5.3.1.5.1.6-.1l.8-1c.2-.2.4-.3.7-.2l2 .9c.3.1.5.2.5.4 0 .3-.1 1.5-.9 2.1-.7.6-1.5.7-1.8.7-.4 0-1-.1-1.9-.5-.6-.2-1.4-.6-2.4-1.2-4-2.5-5.6-5.7-5.7-5.9-.2-.3-.9-1.2-.9-2.4 0-1.1.6-1.6.8-1.8Z" />
                        </svg>
                      ) : icon === "push" ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
                          <path d="M10 5.5h4" />
                          <path d="M11.2 18h1.6" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="5" width="18" height="14" rx="2.2" />
                          <path d="m4.5 7 7.5 6 7.5-6" />
                        </svg>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-accent text-[15px] font-semibold text-[#163629]">
                          {title}
                        </p>
                        <span className="whitespace-nowrap text-[13px] text-[#71867a]">{time}</span>
                      </div>
                      <p className="landing-copy mt-2 text-[15px] leading-8">{message}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="evidence" className="landing-section scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="landing-subtle-card rounded-[32px] p-7 md:p-8">
              <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                <div>
                  <SectionAccent />
                  <span className="landing-pill">What powers the care plan</span>
                  <h2 className="landing-heading mt-5 text-[2.5rem] md:text-[3.9rem]">
                    Real signals, <span className="text-[#566e2e]">clear actions</span>
                  </h2>
                  <p className="landing-copy mt-4 max-w-xl text-base md:text-lg">
                    BloomPilot combines plant identity, local weather, and garden setup so each task is grounded in evidence instead of a generic schedule.
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      ["Weather", "Temperature, humidity, rainfall, and UV shape watering and protection."],
                      ["Plant", "Species, diagnosis, and growth stage change follow-up care."],
                      ["Garden", "Placement, sunlight, and garden type decide what action fits."],
                    ].map(([title, desc]) => (
                      <article key={title} className="rounded-[24px] border border-[#dce7da] bg-white/92 p-5">
                        <p className="font-accent text-base font-semibold text-[#173528]">{title}</p>
                        <p className="landing-copy mt-2 text-sm leading-7">{desc}</p>
                      </article>
                    ))}
                  </div>

                  <div className="rounded-[24px] border border-[#dce7da] bg-[#fbfdf9] p-5">
                    <p className="font-accent text-sm font-semibold text-[#173528]">Connected sources</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {trustItems.map(([name, label]) => (
                        <div key={name} className="flex items-center gap-3 rounded-full border border-[#dce7da] bg-white px-4 py-2.5">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef4e4] text-sm text-[#566e2e]">
                            {name === "Open-Meteo" ? "☁" : name === "PlantNet" ? "🌿" : name === "Diagnosis" ? "⌕" : name === "WhatsApp" ? "◔" : name === "Email" ? "✉" : "◧"}
                          </span>
                          <div className="text-left">
                            <p className="font-accent text-sm font-semibold text-[#163629]">{name}</p>
                            <p className="text-xs text-[#6e8377]">{label}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="audience" className="landing-section scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <SectionAccent />
              <span className="landing-pill">Who it&apos;s for</span>
              <h2 className="landing-heading mt-5 text-[2.5rem] md:text-[3.9rem]">
                Built for every <span className="text-[#566e2e]">garden format</span>
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {audienceCards.map(([title, desc]) => (
                <article key={title} className="landing-card rounded-[28px] p-6">
                  <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4e7]">
                    <span className="text-lg text-[#566e2e]">
                      {title === "Indoor" ? "⌂" : title === "Balcony" ? "▣" : title === "Terrace" ? "△" : "✿"}
                    </span>
                  </div>
                  <h3 className="font-accent text-lg font-semibold text-[#163629]">{title}</h3>
                  <p className="landing-copy mt-3 text-sm leading-7">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="testimonials" className="landing-section scroll-mt-24">
          <div className="mx-auto w-full max-w-7xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <SectionAccent />
              <span className="landing-pill">
                Loved by growers
              </span>
              <h2 className="landing-heading mt-5 text-[2.5rem] md:text-[3.9rem]">
                Real gardens. <span className="text-[#566e2e]">Real results.</span>
              </h2>
            </div>

            <div className="mt-14 grid gap-7 md:grid-cols-3">
              {[
                [
                  "I killed every succulent I owned. BloomPilot turned my balcony into a jungle — the WhatsApp nudges are a game changer.",
                  "Ananya R.",
                  "Apartment gardener · Bengaluru",
                  "ananya",
                ],
                [
                  "The agentic recommendations actually understand my micro-climate. It suggested heirloom tomatoes — best harvest ever.",
                  "Arjun M.",
                  "Terrace grower · Pune",
                  "arjun",
                ],
                [
                  "As a busy parent, email digests keep me on top of the garden without the guilt. Worth every rupee.",
                  "Priya S.",
                  "Weekend grower · Jaipur",
                  "priya",
                ],
              ].map(([quote, name, role, avatarVariant], idx) => (
                <article
                  key={`${name}-${idx}`}
                  className="landing-subtle-card rounded-[30px] px-8 py-9"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-accent max-w-[26ch] text-[17px] leading-7 text-[#163629]">&ldquo;{quote}&rdquo;</p>
                    <span className="text-[48px] leading-none text-[#c8e7d5]">”</span>
                  </div>
                  <div className="mt-8 flex items-center gap-4">
                    <MockAvatar variant={avatarVariant as "ananya" | "arjun" | "priya"} />
                    <div>
                      <p className="font-accent text-[18px] font-semibold text-[#10261c]">
                        {name}
                      </p>
                      <p className="landing-copy mt-1 text-[15px]">{role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="landing-divider" />
        </div>

        <section id="faq" className="landing-section scroll-mt-24">
          <div className="mx-auto w-full max-w-5xl px-6">
            <div className="mx-auto max-w-4xl text-center">
              <SectionAccent />
              <span className="landing-pill">
                FAQ
              </span>
              <h2 className="landing-heading mt-5 text-[2.5rem] md:text-[3.9rem]">
                Questions, <span className="text-[#566e2e]">answered</span>
              </h2>
            </div>

            <div className="mt-14 space-y-5">
              {faqs.map(([question, answer, open], idx) => (
                <details
                  key={`${question}-${idx}`}
                  className="landing-subtle-card group rounded-[30px] px-8 py-7 open:pb-8"
                  open={Boolean(open)}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left">
                    <span className="font-accent text-[1.15rem] font-semibold leading-7 text-[#10261c]">
                      {question}
                    </span>
                    <span className="shrink-0 text-[28px] leading-none text-[#5f7b6c] transition-transform duration-200 group-open:rotate-180">
                      ˅
                    </span>
                  </summary>
                  <p className="landing-copy max-w-[56rem] pt-6 text-[17px] leading-9">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        </div>

        <section className="px-6 pb-10 pt-2">
          <div className="mx-auto w-full max-w-7xl overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_top_right,rgba(173,255,62,0.35),transparent_34%),linear-gradient(135deg,#04a84f_0%,#12b85a_50%,#52c865_100%)] px-7 py-10 shadow-[0_24px_60px_rgba(35,120,56,0.22)] md:rounded-[36px] md:px-14 md:py-16">
            <div className="max-w-4xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-10 bg-white/30" />
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-white/90" />
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/25 bg-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-white/95" />
                </span>
              </div>
              <span className="font-accent inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/88">
                Start with BloomPilot
              </span>
              <h2 className="landing-heading mt-4 max-w-3xl text-[2.5rem] !text-white md:text-[5rem]">
                Ready to grow a garden that grows itself?
              </h2>
              <p className="font-accent mt-5 max-w-3xl text-[16px] leading-8 text-white/92 md:mt-6 md:text-[19px] md:leading-9">
                Join plant owners using BloomPilot to turn location, weather, and plant context into clearer daily care decisions.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
                <Link
                  href="/sign-up"
                  className="font-accent inline-flex items-center justify-center gap-3 rounded-full bg-white px-7 py-3.5 text-[16px] font-semibold text-[#133324] shadow-[0_12px_30px_rgba(255,255,255,0.18)] md:px-8 md:py-4 md:text-[17px]"
                >
                  Create account
                  <span className="text-xl leading-none">→</span>
                </Link>
                <a
                  href="#features"
                  className="font-accent inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-[16px] font-semibold text-white backdrop-blur-sm md:px-8 md:py-4 md:text-[17px]"
                >
                  Explore features
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d7e4da] bg-[#f5f8f5] px-6 py-8 md:py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-accent text-[1.1rem] font-semibold text-[#10261c] md:text-[1.15rem]">
              BloomPilot
            </p>
            <p className="landing-copy mt-2 max-w-md text-sm leading-7">
              AI-powered plant care that turns garden context and local weather into clear daily actions.
            </p>
          </div>

          <div className="font-accent flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-[#4f695b] md:justify-end">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#reminders">Reminders</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#faq">FAQ</a>
            <Link href="/sign-in">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
