"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Expand } from "lucide-react";

/**
 * Demo screenshots.
 *
 * Two stories: what the app looks like once a mess is running, and what a
 * brand-new visitor sees before there is anything to show them.
 *
 * Served through next/image, so the browser gets a responsive WebP instead of
 * the full-size PNG, and only the viewport's worth of shots are fetched. Width
 * and height come from scripts/shoot-demo.mjs, which reserves the exact box
 * before the bytes arrive and keeps layout shift at zero.
 */
const SHOTS = [
  {
    group: "Inside the app",
    src: "/demo/01-dashboard.png",
    width: 1440,
    height: 999,
    name: "Dashboard",
    note: "The month at a glance, with what is still owed called out first.",
  },
  {
    group: "Inside the app",
    src: "/demo/06-reports.png",
    width: 1440,
    height: 1442,
    name: "Reports",
    note: "The settlement itself, laid out to be printed. Every column reconciles to the total.",
    featured: true,
  },
  {
    group: "Inside the app",
    src: "/demo/03-meals.png",
    width: 1440,
    height: 900,
    name: "Meals",
    note: "A month of meals per person, in halves, with running daily totals.",
  },
  {
    group: "Inside the app",
    src: "/demo/02-members.png",
    width: 1440,
    height: 900,
    name: "Members",
    note: "The roster: seat rent, phone, and who has been archived.",
  },
  {
    group: "Inside the app",
    src: "/demo/04-expenses.png",
    width: 1440,
    height: 1533,
    name: "Expenses",
    note: "Bazar spending kept apart from costs that split evenly.",
  },
  {
    group: "Inside the app",
    src: "/demo/05-bills.png",
    width: 1440,
    height: 1181,
    name: "Bills",
    note: "Utilities and one-off charges, entered once and divided automatically.",
  },
  {
    group: "Inside the app",
    src: "/demo/07-settings.png",
    width: 1440,
    height: 900,
    name: "Settings",
    note: "Mess profile and currency. Changing these does not rewrite past months.",
  },

  {
    group: "Before there is anything to show",
    src: "/demo/10-signup.png",
    width: 1440,
    height: 900,
    name: "Create your mess",
    note: "Name the mess, pick a currency, get a shareable join link. No card, no trial timer.",
    featured: true,
  },
  {
    group: "Before there is anything to show",
    src: "/demo/11-login.png",
    width: 1440,
    height: 900,
    name: "Sign in",
    note: "The same page for the owner and for everyone else in the mess.",
  },
  {
    group: "Before there is anything to show",
    src: "/demo/12-empty-dashboard.png",
    width: 1440,
    height: 1293,
    name: "The first empty month",
    note: "A new mess starts here, saying what to enter first instead of showing zeroes.",
    featured: true,
  },
  {
    group: "Before there is anything to show",
    src: "/demo/14-empty-members.png",
    width: 1440,
    height: 900,
    name: "An empty roster",
    note: "Add people, or send the join link and let them add themselves.",
  },
  {
    group: "Before there is anything to show",
    src: "/demo/13-not-found.png",
    width: 1440,
    height: 900,
    name: "A dead link",
    note: "Says so plainly, and offers the way back, instead of pretending the page exists.",
  },
];

const MOBILE = [
  { src: "/demo/09-dashboard-mobile.png", width: 414, height: 2194, name: "Dashboard, on a phone" },
  { src: "/demo/08-reports-mobile.png", width: 414, height: 2243, name: "Reports, on a phone" },
];

/** Tall pages are cropped to their opening rows so the grid stays even. */
const CROP = "h-[22rem] sm:h-[26rem]";

export default function DemoGallery() {
  const [open, setOpen] = useState(null);
  const scroller = useRef(null);
  const restoreFocus = useRef(null);

  const close = useCallback(() => {
    setOpen(null);
    restoreFocus.current?.focus?.();
  }, []);

  const step = useCallback(
    (delta) => setOpen((i) => (i === null ? i : (i + delta + SHOTS.length) % SHOTS.length)),
    [],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    scroller.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, close, step]);

  const current = open === null ? null : SHOTS[open];

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {SHOTS.map((shot, i) => (
          <Fragment key={shot.src}>
            {shot.group !== SHOTS[i - 1]?.group ? (
              <h3 className="sm:col-span-2">
                <span className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {shot.group}
                </span>
              </h3>
            ) : null}
            <figure className={shot.featured ? "sm:col-span-2" : undefined}>
            <button
              type="button"
              onClick={(e) => {
                restoreFocus.current = e.currentTarget;
                setOpen(i);
              }}
              className="group relative block w-full overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface text-left shadow-soft transition-shadow hover:shadow-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className={`block overflow-hidden bg-surface-muted ${shot.featured ? "" : CROP}`}>
                <Image
                  src={shot.src}
                  alt={`${shot.name} screen of MessMate`}
                  width={shot.width}
                  height={shot.height}
                  loading="lazy"
                  quality={75}
                  sizes="(min-width: 640px) 46rem, 100vw"
                  className="w-full"
                />
              </span>
              <span className="pointer-events-none absolute right-3 top-3 grid size-8 place-items-center rounded-full border border-border bg-surface/90 text-muted-foreground opacity-0 shadow-soft transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Expand className="size-4" aria-hidden />
              </span>
            </button>
            <figcaption className="mt-2.5">
              <p className="text-[14px] font-semibold">{shot.name}</p>
              {shot.note ? (
                <p className="mt-0.5 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
                  {shot.note}
                </p>
              ) : null}
            </figcaption>
            </figure>
          </Fragment>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
        <div className="flex gap-4">
          {MOBILE.map((shot) => (
            <figure key={shot.src} className="w-28 shrink-0 sm:w-32">
              <div
                className="overflow-hidden rounded-[var(--radius-field)] border border-border bg-surface-muted shadow-soft"
                style={{ aspectRatio: `${shot.width} / ${Math.round(shot.height / 4)}` }}
              >
                <Image
                  src={shot.src}
                  alt={shot.name}
                  width={shot.width}
                  height={shot.height}
                  loading="lazy"
                  quality={75}
                  sizes="8rem"
                  className="w-full"
                />
              </div>
              <figcaption className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
                {shot.name}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground sm:ml-auto sm:max-w-xs sm:text-right">
          The same screens at phone width. Nothing is hidden behind a wider monitor.
        </p>
      </div>

      {current ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-foreground/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${current.name} screenshot`}
          onClick={close}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-background">
            <p className="text-[14px] font-semibold">{current.name}</p>
            <div className="flex items-center gap-1">
              <LightboxButton label="Previous screenshot" onClick={() => step(-1)}>
                <ChevronLeft className="size-5" aria-hidden />
              </LightboxButton>
              <LightboxButton label="Next screenshot" onClick={() => step(1)}>
                <ChevronRight className="size-5" aria-hidden />
              </LightboxButton>
              <LightboxButton label="Close" onClick={close}>
                <X className="size-5" aria-hidden />
              </LightboxButton>
            </div>
          </div>

          <div
            ref={scroller}
            tabIndex={-1}
            className="flex-1 overflow-y-auto px-4 pb-6 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={current.src}
              alt={`${current.name} screen of MessMate`}
              width={current.width}
              height={current.height}
              quality={90}
              sizes="100vw"
              className="mx-auto h-auto w-auto max-w-full rounded-[var(--radius-card)] border border-border shadow-overlay"
            />
            {current.note ? (
              <p className="mx-auto mt-3 max-w-2xl text-center text-[13px] leading-relaxed text-background/80">
                {current.note}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LightboxButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="grid size-9 place-items-center rounded-full text-background/80 transition-colors hover:bg-background/10 hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
      aria-label={label}
    >
      {children}
    </button>
  );
}
