"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buttonClass } from "@/components/ui/button-classes";

/**
 * Last-resort boundary for a render error. It must be a client component, which
 * means it cannot read the session, so it stays deliberately plain: no layout,
 * no data, nothing that could itself throw.
 */
export default function AppError({ error, reset }) {
  useEffect(() => {
    // Replace with a real reporter before going live. The digest is the only
    // piece that maps back to a server-side stack.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-danger-subtle text-danger">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          That page could not be shown. Trying again often works. If it keeps failing, the error
          reference below will help pin it down.
        </p>

        {error?.digest ? (
          <p className="nums mt-3 inline-block rounded-[var(--radius-field)] bg-surface-muted px-2.5 py-1 text-[11.5px] text-muted-foreground">
            ref: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </Button>
          <Link href="/dashboard" className={buttonClass({ variant: "outline" })}>
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
