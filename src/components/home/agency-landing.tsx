"use client";

import Hls from "hls.js";
import {
  ArrowUpRight,
  Bell,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Droplets,
  Leaf,
  Mail,
  MapPin,
  MessageCircle,
  Play,
  Sprout,
  SunMedium,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type SVGProps } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";

type AuthMode = "sign-in" | "sign-up";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260619_191346_9d19d66e-86a4-47f7-8dc6-712c1788c3b2.mp4";
const CAPABILITIES_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260622_093722_ccfc7ebf-182f-419f-8a62-2dc02db7dd9d.mp4";
const CTA_VIDEO = "https://stream.mux.com/8wrHPCX2dC3msyYU9ObwqNdm00u3ViXvOSHUMRYSEe5Q.m3u8";
const HERO_VIDEO_START = 5.5;

const PLANNER_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PLANNER_LEADING_DAYS = [28, 29, 30];
const PLANNER_DAY_COUNT = 25;
const PLANNER_TODAY = 10;

type PlannerStatus = "done" | "upcoming" | "alert";

const PLANNER_TAG: Record<PlannerStatus, string> = {
  done: "Done",
  upcoming: "Upcoming",
  alert: "Alert",
};

const PLANNER_EVENTS: Record<number, { title: string; time: string; status: PlannerStatus }> = {
  2: { title: "Water basil", time: "7:15 – 8:30 AM", status: "done" },
  6: { title: "Move fern to shade", time: "12:30 – 2:30 PM", status: "done" },
  10: { title: "Check tomato leaves", time: "6:30 – 7:30 PM", status: "alert" },
  14: { title: "Feed tomato vine", time: "8:00 – 9:00 AM", status: "upcoming" },
  18: { title: "Prune basil tips", time: "7:30 – 8:00 AM", status: "upcoming" },
  22: { title: "Repot mint", time: "5:00 – 6:00 PM", status: "upcoming" },
};

const WEATHER_IMPACTS: Array<{
  id: "heat" | "rain" | "uv";
  label: string;
  value: string;
  detail: string;
  decision: string;
  Icon: LucideIcon;
}> = [
  {
    id: "heat",
    label: "Heat",
    value: "31°C",
    detail: "Afternoon peak",
    decision: "Watering moved earlier, to 7:15 AM",
    Icon: SunMedium,
  },
  {
    id: "rain",
    label: "Rain",
    value: "6 mm",
    detail: "Expected overnight",
    decision: "Tomorrow's watering paused",
    Icon: Droplets,
  },
  {
    id: "uv",
    label: "UV",
    value: "High",
    detail: "Midday exposure",
    decision: "Fern moves to shade at 12:30 PM",
    Icon: TriangleAlert,
  },
];

function HeroVideo({
  src,
  className,
  style,
  startAt = 0,
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  startAt?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let didPrime = false;

    const primePlayback = () => {
      video.playbackRate = startAt > 0 ? 0.92 : 1;
      if (!didPrime && startAt > 0 && video.duration > startAt) {
        didPrime = true;
        video.currentTime = startAt;
      }
      void video.play().catch(() => undefined);
    };

    const smoothLoop = () => {
      if (startAt <= 0 || !video.duration) return;
      if (video.duration - video.currentTime < 0.18) {
        video.currentTime = startAt;
        void video.play().catch(() => undefined);
      }
    };

    video.addEventListener("loadedmetadata", primePlayback);
    video.addEventListener("canplay", primePlayback);
    video.addEventListener("timeupdate", smoothLoop);
    primePlayback();

    return () => {
      video.removeEventListener("loadedmetadata", primePlayback);
      video.removeEventListener("canplay", primePlayback);
      video.removeEventListener("timeupdate", smoothLoop);
    };
  }, [startAt]);

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      muted
      playsInline
      autoPlay
      loop={startAt <= 0}
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}

function HlsVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined);
      });
      return () => hls.destroy();
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      void video.play().catch(() => undefined);
    }

    return undefined;
  }, [src]);

  return <video ref={videoRef} className={className} muted playsInline autoPlay loop aria-hidden="true" />;
}

function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 20V9" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path
        d="M12 10.5C8.4 10.5 6 8.1 6 4.6c3.7-.3 6.2 1.8 6 5.9Z"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 13.2c4.2.2 6.8-2.4 6.6-6.4-4.2-.2-6.8 2.5-6.6 6.4Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

function TelegramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M21.4 4.1 3.7 10.9c-1 .4-1 1.8.1 2.1l4.5 1.4 1.8 5.3c.3.9 1.4 1.1 2.1.5l2.6-2.2 4.3 3.2c.7.5 1.7.1 1.9-.8L23 5.5c.2-1-.7-1.8-1.6-1.4Z"
        fill="currentColor"
      />
      <path d="m8.8 14.4 8.5-5.3" stroke="#050605" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function AuthOverlay({
  mode,
  onModeChange,
  onClose,
}: {
  mode: AuthMode | null;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
}) {
  if (!mode) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/78 backdrop-blur-sm"
        aria-label="Close authentication dialog"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[520px]">
        <AuthFormCard mode={mode} onModeChange={onModeChange} onClose={onClose} />
      </div>
    </div>
  );
}

export function AgencyLanding() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);

  useEffect(() => {
    const root = document.querySelector(".agency-page");
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -40px 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
      <main className="agency-page">
        <nav className="agency-nav">
          <Link href="#hero" className="agency-brand font-heading" aria-label="BloomPilot home">
            <span className="agency-brand-wordmark">
              B<span className="agency-brand-l">l<BrandMark className="agency-brand-mark" /></span>oomPilot
            </span>
          </Link>

          <div className="agency-nav-menu font-body" aria-label="Main navigation">
            <a className="agency-nav-link agency-nav-link-active" href="#hero">
              Home
            </a>
            <a className="agency-nav-link" href="#how-it-works">
              How it works
            </a>
            <a className="agency-nav-link" href="#diagnosis">
              Diagnosis
            </a>
            <a className="agency-nav-link" href="#reminders">
              Reminders
            </a>
          </div>

          <div className="agency-nav-actions">
            <button type="button" className="agency-nav-sign-in font-body" onClick={() => setAuthMode("sign-in")}>
              Sign in
            </button>
            <button type="button" className="agency-nav-cta font-body" onClick={() => setAuthMode("sign-up")}>
              Start free <ArrowUpRight className="agency-nav-cta-icon" />
            </button>
          </div>
        </nav>

        <section id="hero" className="agency-section agency-hero">
          <HeroVideo
            src={HERO_VIDEO}
            startAt={HERO_VIDEO_START}
            className="agency-video agency-video-hero"
            style={{ width: "120%", height: "120%" }}
          />
          <div className="agency-hero-content">
            <div className="agency-hero-copy">
              <p
                className="agency-hero-kicker agency-beta-pill font-body"
              >
                <Leaf className="agency-pill-leaf" />
                Free beta access
              </p>

              <h1
                className="agency-hero-title font-heading text-white"
                aria-label="Plant care agent that knows the next action"
              >
                <span>Plant care agent that knows</span>
                <span className="agency-hero-title-second">
                  <span className="agency-hero-title-rotator">
                    <em>the next action</em>
                  </span>
                </span>
              </h1>

              <div
                className="agency-hero-subcopy font-body"
              >
                <p>BloomPilot watches your plants and current conditions.</p>
                <p>It decides when care needs your attention, then sends a clear reminder.</p>
              </div>

              <div
                className="agency-hero-actions font-body"
              >
                <a className="agency-hero-secondary" href="#how-it-works">
                  How it works <Play className="agency-play-icon" fill="currentColor" />
                </a>
                <button type="button" className="agency-hero-primary" onClick={() => setAuthMode("sign-up")}>
                  Start free <ArrowUpRight className="agency-action-icon" />
                </button>
              </div>
            </div>

            <div
              className="agency-hero-benefits font-body"
            >
              <div className="agency-hero-benefit">
                <Leaf className="agency-hero-benefit-icon" />
                <span>
                  <strong>Smart monitoring</strong>
                  <small>Tracks plants and conditions</small>
                </span>
              </div>
              <div className="agency-hero-benefit">
                <Bell className="agency-hero-benefit-icon" />
                <span>
                  <strong>Timely reminders</strong>
                  <small>Right care, right time</small>
                </span>
              </div>
              <div className="agency-hero-benefit">
                <TrendingUp className="agency-hero-benefit-icon" />
                <span>
                  <strong>Better growth</strong>
                  <small>Healthier plants, effortlessly</small>
                </span>
              </div>
            </div>
          </div>
          <div className="agency-hero-fade" />
        </section>

        <div className="agency-ticker" aria-hidden="true">
          <div className="agency-ticker-track">
            {[0, 1].map((copy) => (
              <div className="agency-ticker-group" key={copy}>
                <span>Weather-aware care</span><i />
                <span>Photo diagnosis</span><i />
                <span>Smart reminders</span><i />
                <span>Daily agent briefs</span><i />
                <span>Placement studio</span><i />
                <span>Garden assistant</span><i />
              </div>
            ))}
          </div>
        </div>

        <section className="agency-section agency-promise">
          <span className="agency-orb agency-orb-a" aria-hidden="true" />
          <span className="agency-orb agency-orb-b" aria-hidden="true" />
          <div className="agency-promise-card" data-reveal>
            <p className="agency-eyebrow font-body">The care signal</p>
            <h2 className="font-heading">Care based on your plants, place, and weather.</h2>
            <p className="font-body">
              BloomPilot brings your garden&apos;s context and today&apos;s conditions together, then turns them into one clear next action.
            </p>
          </div>
        </section>

        <section id="how-it-works" className="agency-section agency-how">
          <HeroVideo src={CAPABILITIES_VIDEO} className="agency-video agency-video-capabilities" />
          <div className="agency-capabilities-overlay" />
          <div className="agency-section-inner">
            <div className="agency-section-heading" data-reveal>
              <p className="agency-eyebrow font-body">How it works</p>
              <h2 className="font-heading">From setup to daily care.</h2>
              <p className="font-body">
                Set up once. BloomPilot connects your garden&apos;s context before it recommends anything.
              </p>
            </div>

            <div className="agency-step-grid">
              {[
                ["01", "Add your garden", "Location, garden type, sunlight, and reminder window become the baseline."],
                ["02", "Build your plant list", "Search or upload plants, then save placement and care details."],
                ["03", "Follow the next action", "Daily tasks update when plant needs or weather conditions change."],
              ].map(([step, title, body], index) => (
                <article className="agency-step-card" data-reveal key={step}>
                  <div className="agency-step-top">
                    <span>{step}</span>
                    {index === 0 ? <MapPin className="agency-step-icon" /> : index === 1 ? <Sprout className="agency-step-icon" /> : <ClipboardList className="agency-step-icon" />}
                  </div>
                  <h3 className="font-heading">{title}</h3>
                  <p className="font-body">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="today-care" className="agency-section agency-today-care">
          <div className="agency-section-inner agency-today-care-content">
            <div className="agency-section-heading agency-today-care-copy" data-reveal>
              <p className="agency-today-care-eyebrow font-body">
                <span className="agency-today-care-eyebrow-icon">
                  <Clock3 />
                </span>
                Today&apos;s care
              </p>
              <h2 className="font-heading">What needs attention now and why.</h2>
              <p className="font-body">
                Your whole month at a glance — what&apos;s done, what&apos;s coming, and what needs a look today.
              </p>
            </div>

            <div className="agency-plnr" data-reveal>
              <div className="agency-plnr-bar">
                <strong>July 2026</strong>
                <div className="agency-plnr-legend" aria-hidden="true">
                  <span className="is-done">Done</span>
                  <span className="is-upcoming">Upcoming</span>
                  <span className="is-alert">Alert</span>
                </div>
              </div>
              <div className="agency-plnr-week" aria-hidden="true">
                {PLANNER_WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="agency-plnr-grid">
                {PLANNER_LEADING_DAYS.map((day) => (
                  <div className="agency-plnr-cell is-out" key={`jun-${day}`}>
                    <span className="agency-plnr-date">{day}</span>
                  </div>
                ))}
                {Array.from({ length: PLANNER_DAY_COUNT }, (_, i) => i + 1).map((day) => {
                  const event = PLANNER_EVENTS[day];
                  return (
                    <div className={`agency-plnr-cell${day === PLANNER_TODAY ? " is-today" : ""}`} key={day}>
                      <div className="agency-plnr-cell-head">
                        <span className="agency-plnr-date">{String(day).padStart(2, "0")}</span>
                        {day === PLANNER_TODAY ? <em className="agency-plnr-today">Today</em> : null}
                      </div>
                      {event ? (
                        <div className={`agency-plnr-event is-${event.status}`}>
                          <strong>{event.title}</strong>
                          <div className="agency-plnr-event-foot">
                            <span>{event.time}</span>
                            <b>{PLANNER_TAG[event.status]}</b>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="weather-impact" className="agency-section agency-weather-impact">
          <div className="agency-section-inner agency-wx">
            <div className="agency-section-heading agency-wx-heading" data-reveal>
              <p className="agency-eyebrow font-body">Weather impact</p>
              <h2 className="font-heading">Care changes when conditions change.</h2>
              <p className="font-body">
                BloomPilot reads today&apos;s conditions before deciding whether to water, wait, move, or inspect.
              </p>
            </div>

            <div className="agency-wx-cards">
              {WEATHER_IMPACTS.map(({ id, label, value, detail, decision, Icon }) => (
                <article className={`agency-wx-card is-${id}`} data-reveal key={id}>
                  <div className="agency-wx-scene" aria-hidden="true" />
                  <header className="agency-wx-chip">
                    <Icon aria-hidden="true" />
                    <span>{label}</span>
                  </header>
                  <div className="agency-wx-reading">
                    <b>{value}</b>
                    <span>{detail}</span>
                  </div>
                  <p className="agency-wx-decision">
                    <Sprout aria-hidden="true" />
                    {decision}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="reminders" className="agency-section agency-reminders">
          <div className="agency-reminders-shell">
            <span className="agency-orb agency-orb-a" aria-hidden="true" />
            <div className="agency-reminders-copy" data-reveal>
              <p className="agency-eyebrow font-body">Reminders</p>
              <h2 className="font-heading">Reminders that reach you where you are.</h2>
              <p className="font-body">
                Care lands inside your chosen window and arrives through the first connected channel — Telegram, email, or web push.
              </p>
            </div>

            <div className="agency-rem-stack" data-reveal>
              <article className="agency-rem-card is-telegram">
                <span className="agency-rem-icon">
                  <TelegramIcon />
                </span>
                <div className="agency-rem-title">
                  <strong>Telegram</strong>
                  <span>Task check-in · 6:30 PM</span>
                </div>
                <span className="agency-rem-go">
                  <ArrowUpRight />
                </span>
              </article>

              <article className="agency-rem-card is-email">
                <span className="agency-rem-icon">
                  <Mail />
                </span>
                <div className="agency-rem-title">
                  <strong>Email</strong>
                  <span>Morning care digest · 7:00 AM</span>
                </div>
                <span className="agency-rem-go">
                  <ArrowUpRight />
                </span>
              </article>

              <article className="agency-rem-card is-push is-open">
                <div className="agency-rem-row">
                  <span className="agency-rem-icon">
                    <Bell />
                  </span>
                  <div className="agency-rem-title">
                    <strong>Web push</strong>
                    <span>Watering reminder · 7:15 AM</span>
                  </div>
                  <span className="agency-rem-go">
                    <ArrowUpRight />
                  </span>
                </div>
                <p>Water basil before the afternoon heat builds in.</p>
                <div className="agency-rem-tags">
                  <b>Reminder</b>
                  <span>Today · 7:15 AM</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="diagnosis" className="agency-section agency-diagnosis">
          <div className="agency-section-inner agency-diagnosis-grid">
            <div className="agency-section-heading" data-reveal>
              <p className="agency-eyebrow font-body">Diagnosis</p>
              <h2 className="font-heading">Scan a plant before you treat it.</h2>
              <p className="font-body">
                Snap a photo. BloomPilot names the likely issue, shows how sure it is, and ties the follow-up to the right plant.
              </p>
            </div>
            <div className="agency-scan" data-reveal>
              <div className="agency-scan-top" aria-hidden="true">
                <span className="agency-scan-time">3:14</span>
                <span className="agency-scan-notch" />
                <span className="agency-scan-btn">
                  <Camera />
                </span>
              </div>
              <img
                src="/images/diagnosis-cactus.png"
                alt=""
                aria-hidden="true"
                className="agency-scan-plant"
              />
              <div className="agency-scan-frame" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <span className="agency-scan-line" />
              </div>
              <div className="agency-scan-result">
                <strong>Cactus stress check</strong>
                <p>Visible surface marks detected. Review confidence before changing care.</p>
                <div className="agency-scan-stats">
                  <div>
                    <b>75%</b>
                    <span>Confidence</span>
                  </div>
                  <div>
                    <b>35%</b>
                    <span>Spread risk</span>
                  </div>
                  <span className="agency-scan-go">
                    <ArrowUpRight />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="placement-studio" className="agency-section agency-studio">
          <div className="agency-section-inner agency-studio-grid">
            <div className="agency-section-heading" data-reveal>
              <p className="agency-eyebrow font-body">Garden studio</p>
              <h2 className="font-heading">Arrange your garden in 3D.</h2>
              <p className="font-body">
                Drag plants around a live model of your balcony. Light zones and watering maps show where each plant fits best.
              </p>
              <div className="agency-studio-points">
                <div><CheckCircle2 /> Drag and drop plants in a real 3D layout.</div>
                <div><CheckCircle2 /> Light zones and watering heatmaps as overlays.</div>
                <div><CheckCircle2 /> One-tap auto-arrange by light and watering.</div>
              </div>
            </div>
            <div className="agency-studio-demo" data-reveal>
              <div className="agency-studio-demo-bar">
                <div>
                  <span />
                  <span />
                  <span />
                </div>
                <strong>Balcony studio</strong>
                <b>Real product</b>
              </div>
              <HeroVideo src="/studio-workflow.mp4" className="agency-studio-demo-video" />
            </div>
          </div>
        </section>

        <section id="assistant" className="agency-section agency-assistant">
          <div className="agency-section-inner agency-assistant-grid">
            <div className="agency-section-heading" data-reveal>
              <p className="agency-eyebrow font-body">Assistant</p>
              <h2 className="font-heading">Chat with the garden context already loaded.</h2>
              <p className="font-body">
                Ask about any plant, task, or reminder. Answers come from your saved garden — never from zero.
              </p>
            </div>

            <div className="agency-assistant-demo" data-reveal aria-label="BloomPilot assistant workflow preview">
              <div className="agency-assistant-workflow">
                <div className="agency-assistant-windowbar">
                  <div>
                    <span />
                    <span />
                    <span />
                  </div>
                  <strong>Garden assistant</strong>
                  <b>Live context</b>
                </div>

                <div className="agency-assistant-feed">
                  <div className="agency-assistant-bubble is-user">
                    My basil looks dry. Should I water it now?
                  </div>
                  <div className="agency-assistant-bubble is-bot">
                    Yes. Basil is due first because the soil was marked dry and today’s heat is rising.
                  </div>
                  <div className="agency-assistant-action-card">
                    <div>
                      <span>Recommended action</span>
                      <strong>Water basil before 2 PM</strong>
                      <p>Use a deep soak, then skip evening watering unless the top soil dries again.</p>
                    </div>
                    <b>Reminder ready</b>
                  </div>
                  <div className="agency-assistant-bubble is-user is-second">
                    What about the fern?
                  </div>
                  <div className="agency-assistant-bubble is-bot is-second">
                    Move it inward. Its saved balcony spot gets too much direct afternoon light.
                  </div>
                </div>

                <div className="agency-assistant-composer">
                  <span>Ask about basil, fern, tasks, or reminders...</span>
                  <ArrowUpRight />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="agency-final-cta">
          <HlsVideo src={CTA_VIDEO} className="agency-video agency-final-cta-video" />
          <div className="agency-final-cta-overlay" />
          <div className="agency-final-cta-inner">
            <div data-reveal>
              <p className="agency-final-cta-kicker font-body">Free while BloomPilot is in beta</p>
              <h2 className="font-heading">
                Start with one clear <em>care plan.</em>
              </h2>
              <p>
                Add your plants once. BloomPilot watches your garden context, weather, reminders, and follow-up history so the next action is always clear.
              </p>
              <div className="agency-final-cta-proof">
                <span>Plant-aware tasks</span>
                <span>Weather-based reminders</span>
                <span>Diagnosis follow-through</span>
              </div>
              <div className="agency-final-cta-actions">
                <button type="button" className="agency-final-primary" onClick={() => setAuthMode("sign-up")}>
                  Start free <ArrowUpRight className="agency-action-icon" />
                </button>
                <button type="button" className="agency-final-secondary liquid-glass" onClick={() => setAuthMode("sign-in")}>
                  Sign in <MessageCircle className="agency-action-icon" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <footer className="agency-footer font-body">
          <p>© 2026 BloomPilot. All rights reserved.</p>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <a href="mailto:hello@bloompilot.app">Contact</a>
          </div>
        </footer>

        <AuthOverlay mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} />
      </main>
  );
}
