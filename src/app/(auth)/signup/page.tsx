import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthCard title="Create your account" description="Track trades, prices and profit after tax. Free, private, manual.">
      <SignUpForm />
    </AuthCard>
  );
}
