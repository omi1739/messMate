import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Brand } from "@/components/brand";
import { buttonClass } from "@/components/ui/button-classes";

export function MarketingHeader() {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5">
        <Brand href="/" />

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Sections">
          <HeaderLink href="#calculation">The calculation</HeaderLink>
          <HeaderLink href="#rules">The rules</HeaderLink>
          <HeaderLink href="#demo">Screens</HeaderLink>
          <HeaderLink href="#faq">FAQ</HeaderLink>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Link
            href="/login"
            className={buttonClass({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}
          >
            Sign in
          </Link>
          <Link href="/signup" className={buttonClass({ size: "sm" })}>
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }) {
  return (
    <a
      href={href}
      className="rounded-md px-2.5 py-1.5 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      {children}
    </a>
  );
}

export function MarketingFooter() {
  return (
    <footer className="no-print border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm space-y-3">
          <Brand href="/" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Mess accounting for shared kitchens. Track bazar, seat rent, utilities and daily meals,
            then let the settlement do the arguing for you.
          </p>
        </div>

        <div className="flex gap-10 text-[13px]">
          <div className="space-y-2">
            <p className="font-semibold">Product</p>
            <FooterLink href="#calculation">The calculation</FooterLink>
            <FooterLink href="#rules">The four rules</FooterLink>
            <FooterLink href="#demo">Screens</FooterLink>
            <FooterLink href="#features">Details</FooterLink>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">Account</p>
            <FooterLink href="/signup">Set up a mess</FooterLink>
            <FooterLink href="/login">Sign in</FooterLink>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-5 text-[12.5px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} MessMate. Built for people who cook for a living.</p>
          <p>One account per mess — your members never need an account.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }) {
  return (
    <Link
      href={href}
      className="block text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}
