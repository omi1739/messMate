import Link from "next/link";
import { buttonClass } from "@/components/ui/button-classes";

/**
 * App-wide 404. Kept at the root so it also catches unknown public URLs, not
 * just owner pages.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="nums text-[13px] font-semibold uppercase tracking-wide text-primary">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">This page does not exist</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          The link may be out of date, or the page may have moved.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link href="/" className={buttonClass({ variant: "outline" })}>
            Back to home
          </Link>
          <Link href="/dashboard" className={buttonClass()}>
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
