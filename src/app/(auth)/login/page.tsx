import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/auth-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { safeRedirectPath } from "@/lib/security/redirect";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Please request a new one.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthCard title="Sign in" description="Welcome back. Your portfolio is waiting.">
      {error && ERRORS[error] && (
        <Alert variant="destructive">
          <AlertDescription>{ERRORS[error]}</AlertDescription>
        </Alert>
      )}
      <SignInForm next={safeRedirectPath(next)} />
    </AuthCard>
  );
}
