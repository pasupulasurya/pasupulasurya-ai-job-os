import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthBanner } from "@/components/auth/auth-banner";

export default function AuthCodeErrorPage() {
  return (
    <AuthShell title="Link didn't work" subtitle="The sign-in link is invalid or expired.">
      <div className="space-y-6">
        <AuthBanner
          variant="error"
          title="Authentication failed"
          message="Magic links expire after 1 hour and can only be used once. Try sending a new one."
        />
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="bg-accent text-accent-foreground hover:bg-accent-hover flex items-center justify-center rounded-md px-4 py-3 text-sm font-medium transition-colors"
          >
            Try signing in again
          </Link>
          <Link
            href="/"
            className="text-text-secondary hover:text-text-primary flex items-center justify-center rounded-md px-4 py-3 text-sm font-medium transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
