import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/dal";
import { MarketingFooter, MarketingHeader } from "./chrome";
import DemoGallery from "./demo-gallery";
import { ArrowRight, Printer } from "lucide-react";
import { buttonClass } from "@/components/ui/button-classes";

export const metadata = {
  title: "MessMate — the monthly mess settlement, worked out for you",
  description:
    "Track bazar, seat rent, utilities and daily meals for a shared mess. MessMate shows its working and tells you exactly who owes what.",
};

export default async function MarketingPage() {
  // The proxy already bounces signed-in users away from "/", but checking here
  // means a logged-in visitor never pays to render the landing page at all.
  const user = await getCurrentUser();
  if (user) redirect(user.isAdmin ? "/admin" : "/dashboard");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <MarketingHeader />

      <main className="flex-1">
        <Hero />
        <TheCalculation />
        <TheRules />
        <WhatYouDo />
        <Demo />
        <TheDetails />
        <Faq />
        <ClosingCta />
      </main>

      <MarketingFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-14 sm:py-20 lg:grid-cols-[1fr_1fr] lg:items-start lg:gap-14 lg:py-24">
        <div className="lg:sticky lg:top-24">
          <h1 className="text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.02em] sm:text-5xl lg:text-[3.25rem]">
            The month&rsquo;s mess bill,
            <br />
            <span className="text-muted-foreground">worked out and shown.</span>
          </h1>

          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted-foreground">
            Log the bazar, the rent and who ate what. MessMate turns it into one settlement per
            person &mdash; and prints the working, so the argument at the end of the month is
            already settled.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClass({ size: "lg", className: "group" })}>
              Set up your mess
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link href="/login" className={buttonClass({ variant: "outline", size: "lg" })}>
              Sign in
            </Link>
          </div>

          <p className="mt-6 text-[13.5px] text-muted-foreground">
            One account per mess. The people you cook for are records, not users &mdash; nobody
            else signs up, and there are no passwords to hand out.
          </p>
        </div>

        {/* The product is the calculation. Show its shape rather than invent a month. */}
        <div className="lg:pt-2">
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-overlay">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[14px] font-semibold">Everything a month comes down to</p>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                No sample figures. This is the whole method, in three lines.
              </p>
            </div>

            <div className="divide-y divide-border">
              <Formula
                label="The meal rate"
                lines={["bazar spending", "─────────────  ÷  meals eaten"]}
                note="Worked out once, then frozen for the month."
              />
              <Formula
                label="What each person owes"
                lines={[
                  "meals × rate  +  seat rent  +  utility share",
                ]}
                note="Charged to whoever ate, for however long they stayed."
              />
              <Formula
                label="Why the report balances"
                lines={["collected  +  still owing  =  total billed"]}
                note="Checked on the page, not asserted in a tooltip."
              />
            </div>
          </div>

          <p className="mt-3 text-[12px] text-muted-foreground">
            Your real numbers take their place the moment you add your first member.
          </p>
        </div>
      </div>
    </section>
  );
}

function Formula({ label, lines, note }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
      {lines.map((line) => (
        <p
          key={line}
          className="mt-1.5 font-mono text-[13px] leading-relaxed tracking-tight text-foreground sm:text-[13.5px]"
        >
          {line}
        </p>
      ))}
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{note}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

const FORMULAS = [
  {
    label: "Set the rate once",
    formula: "meal rate = bazar spending ÷ meals eaten",
    body: "Only groceries set it. Cleaning, repairs and furniture are shared out separately, so one expensive dinner does not quietly raise everyone’s meal cost for the month.",
  },
  {
    label: "Charge the person who ate",
    formula: "each share = meals × rate + seat rent + utility share",
    body: "Rent is each person’s own figure, not a share you work out for them. Utilities and one-off charges divide across the people actually living there that month.",
  },
  {
    label: "Keep the books square",
    formula: "billed = collected + outstanding",
    body: "Every figure is rounded per row, and the leftover is carried as an explicit adjustment. The columns land on the headline total instead of drifting past it.",
  },
];

function TheCalculation() {
  return (
    <section id="calculation" className="scroll-mt-20 border-b border-border bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
            Three lines of arithmetic, and nothing hidden behind them
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Costing a shared kitchen only turns into an argument when people cannot see how the
            number was reached. So the calculation is not summarised behind a total &mdash; it is
            the product.
          </p>
          <p className="mt-5 text-[13.5px] leading-relaxed text-muted-foreground">
            The same three lines every month. That is what makes an old report worth arguing from.
          </p>
        </div>

        <ol className="divide-y divide-border border-y border-border">
          {FORMULAS.map((item, index) => (
            <li key={item.label} className="py-7">
              <div className="flex items-baseline gap-4">
                <span className="nums shrink-0 text-[13px] font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-semibold leading-snug">{item.label}</h3>
                  <p className="mt-2.5 overflow-x-auto rounded-[var(--radius-field)] border border-border bg-background px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed tracking-tight sm:text-[13px]">
                    {item.formula}
                  </p>
                  <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const RULES = [
  {
    rule: "Meals are charged to whoever ate them",
    detail:
      "Including people who have since left. The food was bought and eaten, so that person owes their share of it — until it is collected.",
  },
  {
    rule: "Someone who leaves mid-month stops owing the fixed costs",
    detail:
      "Their seat rent and their share of utilities end on the day they go. Their meals do not, and their payment history stays, so every earlier month still balances.",
  },
  {
    rule: "Half meals are counted as half",
    detail:
      "Meal counts are held in halves, so someone who only ate dinner is recorded as half a meal rather than rounded up. Rounding is where messes quietly lose track of who ate what.",
  },
  {
    rule: "Each month stands on its own",
    detail:
      "Meals, spending and payments are all held per month. Move between months freely — last March is still there, still reconciling, still printable.",
  },
];

function TheRules() {
  return (
    <section id="rules" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
          The four rules that decide who pays what
        </h2>

        <ol className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {RULES.map((item, index) => (
            <li key={item.rule} className="border-t border-border pt-5">
              <p className="nums text-[12.5px] font-semibold text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-[15.5px] font-semibold leading-snug">{item.rule}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const STEPS = [
  {
    title: "Name the people you cook for",
    body: "A name, a phone number, their seat rent and when they joined. That is the whole record. No invitation, no password, nothing for them to do.",
  },
  {
    title: "Log what the month actually cost",
    body: "Every bazar run goes in with a date, a category and an amount. Utilities and one-off charges are entered once and split automatically.",
  },
  {
    title: "Mark meals as you go",
    body: "Breakfast, lunch and dinner per person, in halves. A single tap fills an ordinary day; edit the odd cell when plans change.",
  },
  {
    title: "Collect, and print the statement",
    body: "Record what each person has paid, watch the outstanding figure fall, and hand over a statement the whole mess can read without you explaining it.",
  },
];

function WhatYouDo() {
  return (
    <section id="how" className="scroll-mt-20 border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
          Four things to do. Then the month takes care of itself.
        </h2>

        <div className="mt-12 grid gap-x-12 gap-y-9 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <div key={step.title}>
              <p className="nums text-[12.5px] font-semibold text-muted-foreground">
                Step {index + 1}
              </p>
              <h3 className="mt-2 text-[15.5px] font-semibold leading-snug">{step.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Real screenshots of the app, taken from the seeded development fixtures by
 * `npm run shoot:demo`. This is the part of the page that cannot be faked - the
 * pixels are the actual screens.
 */
function Demo() {
  return (
    <section id="demo" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <div className="max-w-2xl">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
            The screens you will actually use
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            No mockups. These are the built pages, filled with a month of sample
            data so you can see a full settlement rather than an empty screen.
          </p>
        </div>

        <div className="mt-12">
          <DemoGallery />
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * A definition list rather than a grid of icon cards, because the content is
 * uneven sentences — and pretending otherwise is what makes a feature grid feel
 * like filler.
 */
const DETAILS = [
  {
    term: "Half meals are first class",
    detail:
      "Meal counts are stored in halves, not whole numbers, so a half-eaten day is recorded as one rather than rounded to two.",
  },
  {
    term: "Archived members drop out of shared costs",
    detail:
      "Mark someone archived and they stop being charged rent and utilities from that day. Their meals and their payment history stay on record.",
  },
  {
    term: "Each month stands alone",
    detail:
      "Meals, spending and payments are all held per month, so an old month can be reopened, checked and reprinted whenever someone disputes it.",
  },
  {
    term: "Bazar and other spending stay separate",
    detail:
      "Only groceries set the meal rate. Everything else is shared evenly instead, so the two kinds of cost can be reviewed independently.",
  },
  {
    term: "Built to be printed",
    detail:
      "Reports are laid out for paper or PDF, with the working on the page. Members get a number they can check instead of a figure you have to defend.",
  },
  {
    term: "One mess, one owner",
    detail:
      "Accounts are isolated at the database level, not just in the interface. There is no shared login to leak and no way to reach another mess, even by editing a URL.",
  },
];

function TheDetails() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <h2 className="max-w-2xl text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
          The details that decide whether it works
        </h2>

        <dl className="mt-12 grid gap-x-12 gap-y-8 sm:grid-cols-2">
          {DETAILS.map((item) => (
            <div key={item.term} className="border-t border-border pt-5">
              <dt className="text-[14.5px] font-semibold">{item.term}</dt>
              <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                {item.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const FAQS = [
  {
    q: "Do my mess members need accounts?",
    a: "No. One account runs one mess — yours. Members are records: a name, phone number and seat rent. There is nothing for them to sign up for, and no password to share, reset or leak.",
  },
  {
    q: "What happens when someone leaves?",
    a: "Set them to archived. They stop being charged rent and utility shares from that day, but their meal history and any payments stay on record — so they still owe for the meals they ate, and last month still balances.",
  },
  {
    q: "Someone was away for two days. How do I record that?",
    a: "Leave their cells empty for those days. Meals are held in halves, so if someone ate only dinner you record half a meal rather than rounding up to a whole one.",
  },
  {
    q: "How is the meal rate actually worked out?",
    a: "Total bazar spending divided by total meals eaten that month, fixed once and applied to everyone for the whole month. Nobody’s bill changes because somebody else ate first.",
  },
  {
    q: "Can I see the working, not just a total?",
    a: "That is the main screen. Meals times rate, rent, utility share and everything collected are shown per person, with the columns reconciling to the headline total on the page.",
  },
  {
    q: "What does it cost?",
    a: "Nothing to start. Set the mess up, add your members and see this month’s settlement before you pay for anything.",
  },
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
        <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2rem]">
          Questions a mess manager actually asks
        </h2>

        <div className="mt-10 divide-y divide-border border-y border-border">
          {FAQS.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14.5px] font-semibold marker:hidden">
                {item.q}
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="size-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </span>
              </summary>
              <p className="pb-4 text-[13.5px] leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ClosingCta() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-[2.25rem]">
              This month&rsquo;s settlement is a few minutes away
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Set the mess up, add the people you cook for, and see where the month stands before
              you close the kitchen.
            </p>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <Link href="/signup" className={buttonClass({ size: "lg", className: "group" })}>
              Set up your mess
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link href="/login" className={buttonClass({ variant: "outline", size: "lg" })}>
              Sign in
            </Link>
          </div>
        </div>

        <p className="mt-10 flex items-center gap-2 border-t border-border pt-5 text-[13px] text-muted-foreground">
          <Printer className="size-4 shrink-0" aria-hidden />
          Every report is laid out to be printed or saved as a PDF.
        </p>
      </div>
    </section>
  );
}
