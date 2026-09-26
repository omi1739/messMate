import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { MarketingFooter, MarketingHeader } from "./chrome";
import {
  ArrowRight,
  Calculator,
  CalendarCheck,
  CheckCircle2,
  Coins,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { buttonClass } from "@/components/ui/button-classes";
import { formatMoney } from "@/lib/money";
import Link from "next/link";

export const metadata = {
  title: "MessMate — Run your mess without the spreadsheet",
  description:
    "Track bazar, seat rent, utility bills and daily meals for a shared mess. MessMate works out exactly who owes what, every month, automatically.",
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
        <Problem />
        <HowItWorks />
        <Features />
        <TheMath />
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
    <section className="relative overflow-hidden border-b border-border">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary-subtle/50 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:py-24">
        <div className="max-w-xl">
          <Chip>One account per mess · members never sign up</Chip>

          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            Run your mess without
            the <span className="text-primary">spreadsheet</span>.
          </h1>

          <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
            Log what you spend at the bazar, what each person pays for rent, and who ate what each
            day. MessMate turns that into one monthly settlement — so nobody has to{" "}
            <span className="text-foreground">"do the math"</span> at 11pm again.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={buttonClass({ size: "lg", className: "group" })}>
              Create your mess
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link href="/login" className={buttonClass({ variant: "outline", size: "lg" })}>
              I already have an account
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-[13.5px] text-muted-foreground">
            {[
              "No card needed",
              "Set up in 2 minutes",
              "Only you need an account",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <SettlementPreview />
      </div>
    </section>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-primary-border bg-primary-subtle px-3 py-1 text-[12.5px] font-medium text-primary">
      <span className="size-1.5 rounded-full bg-primary" aria-hidden />
      {children}
    </span>
  );
}

/** A static, server-rendered glimpse of the real report. No client JS. */
function SettlementPreview() {
  const rows = [
    { name: "Rakib", meals: 78, rent: 4500, due: 7418, paid: 7000, tone: "text-danger" },
    { name: "Nayeem", meals: 61, rent: 5000, due: 7009, paid: 7000, tone: "text-warning" },
    { name: "Tanvir", meals: 83, rent: 4500, due: 7681, paid: 7681, tone: "text-success" },
  ];

  return (
    <div className="relative">
      <div
        className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-primary/12 via-transparent to-transparent blur-2xl"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-overlay">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold">September 2026 settlement</p>
            <p className="text-[11.5px] text-muted-foreground">8 active members · bazar ৳28,400</p>
          </div>
          <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-[11.5px] font-medium text-primary">
            Live
          </span>
        </div>

        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="p-4">
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
              Meal rate
            </p>
            <p className="nums mt-1 text-2xl font-semibold">{formatMoney(36.92)}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">per meal, this month</p>
          </div>
          <div className="p-4">
            <p className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
              Still outstanding
            </p>
            <p className="nums mt-1 text-2xl font-semibold text-danger">{formatMoney(1427)}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">across 2 members</p>
          </div>
        </div>

        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-border bg-surface-muted/70 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-semibold">Member</th>
              <th className="px-2 py-2 text-right font-semibold">Meals</th>
              <th className="px-2 py-2 text-right font-semibold">Due</th>
              <th className="px-4 py-2 text-right font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.name}>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">
                    rent {formatMoney(row.rent)}
                  </p>
                </td>
                <td className="nums px-2 py-2.5 text-right">{row.meals}</td>
                <td className="nums px-2 py-2.5 text-right">{formatMoney(row.due)}</td>
                <td className={`px-4 py-2.5 text-right text-[12.5px] font-medium ${row.tone}`}>
                  {row.due > row.paid
                    ? `owes ${formatMoney(row.due - row.paid)}`
                    : "settled"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const PAINS = [
  {
    icon: Calculator,
    title: "The end-of-month math",
    body: "Someone always volunteers to divide the bazar bill by the number of meals, and someone always gets it subtly wrong.",
  },
  {
    icon: Wallet,
    title: "Rent, utilities, gas, wifi",
    body: "Four different bills, split three different ways, remembered from memory. Nobody has a clear picture of what the mess actually costs.",
  },
  {
    icon: CalendarCheck,
    title: "Who ate what, every day",
    body: "People are away, guests show up, someone eats half a breakfast. A tally on the fridge is not a database.",
  },
];

function Problem() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <SectionHeading
          eyebrow="The problem"
          title="Running a mess is three ledgers and a lot of goodwill"
          description="Almost every mess keeps the same three books somewhere — bazar, fixed bills, and daily meals. Keeping them apart and reconciling them at month end is the entire job. MessMate merges them into one place and does the reconciliation for you."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PAINS.map((pain) => (
            <div
              key={pain.title}
              className="rounded-[var(--radius-card)] border border-border bg-background p-5"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-danger-subtle text-danger">
                <pain.icon className="size-[18px]" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{pain.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{pain.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const STEPS = [
  {
    icon: Users,
    title: "Add your members",
    body: "Name, phone, seat rent and joining date. Members are records, not users — they never need to sign in, and you never have to hand out passwords.",
  },
  {
    icon: Receipt,
    title: "Log bazar and other spending",
    body: "Each grocery run goes in with a date, a category and an amount. Bazar spending drives the meal rate; everything else is shared evenly.",
  },
  {
    icon: CalendarCheck,
    title: "Mark daily meals",
    body: "Breakfast, lunch and dinner per person, in halves. One tap for an ordinary day where everyone ate, and edit single cells when someone was away.",
  },
  {
    icon: LayoutDashboard,
    title: "Collect the settlement",
    body: "Record what each person paid, see exactly what is still outstanding, and print a clean statement the whole mess can read.",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <SectionHeading
          eyebrow="How it works"
          title="Four things to do. Then the month takes care of itself."
          description="There is no per-member setup and no invitations to send. You create the mess, you are done."
        />

        <ol className="mt-12 grid gap-5 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="relative rounded-[var(--radius-card)] border border-border bg-surface p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary">
                  <step.icon className="size-[18px]" aria-hidden />
                </span>
                <span className="nums text-[12px] font-semibold text-muted-foreground">
                  STEP {index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: Calculator,
    title: "Automatic monthly settlement",
    body: "Meal rate, seat rent, utilities and shared costs are combined per person. No spreadsheets, no re-deriving last month's answer.",
  },
  {
    icon: CalendarCheck,
    title: "Half-meal accuracy",
    body: "Someone eating only dinner? Record 0.5. Meal counts are tracked in halves, which is where most messes quietly lose track.",
  },
  {
    icon: Wallet,
    title: "Utility bills that add up",
    body: "Water, electricity, gas, internet, plus any one-off charges you need — split evenly across active members.",
  },
  {
    icon: Users,
    title: "Seat rent per person",
    body: "Give each member their own rent. Active members are charged; archived ones are not, so leavers stop appearing in the maths.",
  },
  {
    icon: TrendingUp,
    title: "Track what you actually spent",
    body: "See bazar versus other spending, month over month, so you know where the money is really going.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    body: "Your mess's data belongs to you alone. Each account is fully isolated, and members' personal details are never exposed anywhere public.",
  },
];

function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <SectionHeading
          eyebrow="Features"
          title="Everything a mess manager actually needs"
          description="No feature list padded with things a kitchen does not need. Just the things that make month-end boring instead of stressful."
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-[var(--radius-card)] border border-border bg-background p-5"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-primary-subtle text-primary">
                <feature.icon className="size-[18px]" aria-hidden />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function TheMath() {
  const rows = [
    {
      head: "Meal cost",
      formula: "meals eaten × meal rate",
      note: "Charged to everyone, because you pay for the food you ate. Meal rate = total bazar ÷ total meals.",
    },
    {
      head: "Seat rent",
      formula: "that member's own rent",
      note: "Only charged to active members. Archived members are skipped entirely.",
    },
    {
      head: "Utilities",
      formula: "(water + electric + gas + wifi + extras) ÷ active members",
      note: "Split evenly, so the mess pays each utility bill once and shares it out.",
    },
    {
      head: "Other shared costs",
      formula: "(cleaning, maintenance, furniture…) ÷ active members",
      note: "Every non-bazar expense is shared evenly among active members.",
    },
  ];

  return (
    <section id="math" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
          <div>
            <SectionHeading
              eyebrow="The math"
              title="Four rules. No surprises."
              description="Mess costing only feels unfair when people cannot see how the number was reached. Here is the entire calculation — it is the same on every report, and the rate is fixed once for the whole month."
            />
            <p className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-[13.5px] leading-relaxed text-muted-foreground">
              <Coins className="mr-2 inline size-4 text-primary" aria-hidden />
              One rate for everyone, all month. If the rate changed as people ate, the last
              person would always be the one left covering the difference.
            </p>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
            <ul className="divide-y divide-border">
              {rows.map((row) => (
                <li key={row.head} className="p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="text-[14.5px] font-semibold">{row.head}</h3>
                    <code className="nums rounded-md bg-surface-muted px-2 py-1 text-[12px] font-medium text-primary">
                      {row.formula}
                    </code>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{row.note}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-surface-muted/60 p-5">
              <p className="text-[13.5px] font-semibold">What a member owes</p>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                meal cost + seat rent + utility share + other shared costs, minus whatever they
                have already paid. A positive number means they owe you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const FAQS = [
  {
    q: "Do my mess members need to create accounts?",
    a: "No. One account runs one mess — yours. Members are simply records: a name, phone number and seat rent. There is nothing for them to sign up for, and no password to share or reset.",
  },
  {
    q: "What happens when someone leaves?",
    a: "Set them to Archived. They stop being charged rent and utility shares from then on, but their meal history and past payments stay on record so old months still balance out.",
  },
  {
    q: "Someone was away for two days. How do I record that?",
    a: "Leave their cells at zero for those days. Meal counts are tracked in halves, so if someone ate only dinner you record 0.5 rather than rounding up to a full meal.",
  },
  {
    q: "How is the meal rate worked out?",
    a: "Total bazar spending divided by total meals eaten that month. It is calculated once and applied to everyone for the whole month, so nobody's bill changes because someone else ate first.",
  },
  {
    q: "Can I see the whole report as a bill?",
    a: "Yes. Every report is laid out to be printed or saved as a PDF, with a clear summary per member and a total at the bottom that always reconciles.",
  },
  {
    q: "What does it cost?",
    a: "Nothing to start. Create your mess, add your members, and see the settlement for this month before you pay for anything.",
  },
];

function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-b border-border bg-surface">
      <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:py-20">
        <SectionHeading eyebrow="FAQ" title="Questions a mess manager actually asks" />

        <div className="mt-10 divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border bg-background">
          {FAQS.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-semibold marker:hidden">
                {item.q}
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  <svg viewBox="0 0 20 20" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </span>
              </summary>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{item.a}</p>
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
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-subtle/50 via-transparent to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-3xl px-5 py-20 text-center sm:py-24">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your next settlement is two minutes away
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
          Create your mess, add the people you cook for, and see this month's numbers before you
          close the kitchen.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className={buttonClass({ size: "lg" })}>
            Create your mess
          </Link>
          <Link href="/login" className={buttonClass({ variant: "outline", size: "lg" })}>
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[27px] font-semibold leading-tight tracking-tight sm:text-[32px]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
