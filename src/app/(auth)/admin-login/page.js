import { AdminLoginForm } from "../auth-forms";
import { AlertCircle } from "lucide-react";

export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({ searchParams }) {
  const params = await searchParams;

  const banner = params?.error ? (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[var(--radius-field)] border border-danger/25 bg-danger-subtle px-3 py-2.5 text-[13px] font-medium"
    >
      <AlertCircle className="mt-px size-4 shrink-0 text-danger" aria-hidden />
      Those admin credentials are not correct.
    </p>
  ) : null;

  return <AdminLoginForm banner={banner} />;
}
