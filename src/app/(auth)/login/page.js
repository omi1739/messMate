import { LoginForm } from "../auth-forms";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Sign in" };

const ERROR_MESSAGES = {
  CredentialsSignin: "That email and password combination is not correct.",
  AccessDenied: "That account is not allowed to sign in. Contact the platform owner.",
  Configuration: "Sign-in is misconfigured on this server. Check the environment variables.",
  Default: "We could not sign you in. Please try again.",
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === "string" ? params.next : undefined;
  const banner = buildBanner(params?.error, params?.next);

  return <LoginForm next={next} banner={banner} />;
}

function buildBanner(error, next) {
  if (error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-[var(--radius-field)] border border-danger/25 bg-danger-subtle px-3 py-2.5 text-[13px] font-medium"
      >
        <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
        {ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default}
      </p>
    );
  }

  // A protected page bounced the visitor here without a session.
  if (next) {
    return (
      <p
        role="status"
        className="rounded-[var(--radius-field)] border border-border bg-surface-muted px-3 py-2.5 text-[13px] text-muted-foreground"
      >
        Please sign in to continue.
      </p>
    );
  }

  return null;
}
