"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { MailCheck } from "lucide-react";
import { Field, FormError } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/actions/auth";
import { forgotPasswordSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@/lib/validation/schemas";

export function SignInForm({ next }: { next?: string }) {
  const form = useForm({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const { submit, pending, formError } = useActionForm(form, (v) => signIn(v, next));
  const { errors } = form.formState;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input type="email" autoComplete="email" {...aria} {...form.register("email")} />}
      </Field>
      <Field id="password" label="Password" error={errors.password?.message}>
        {(aria) => <Input type="password" autoComplete="current-password" {...aria} {...form.register("password")} />}
      </Field>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create account
        </Link>
      </div>
    </form>
  );
}

function CheckEmail({ message }: { message: string }) {
  return (
    <div className="grid justify-items-center gap-3 rounded-lg border bg-card p-6 text-center" role="status">
      <MailCheck className="size-8 text-primary" aria-hidden="true" />
      <p className="text-sm">{message}</p>
      <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

export function SignUpForm() {
  const [done, setDone] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });
  const { submit, pending, formError } = useActionForm(form, signUp, {
    onSuccess: (_d, message) => setDone(message ?? "Check your email to continue."),
  });
  const { errors } = form.formState;
  if (done) return <CheckEmail message={done} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input type="email" autoComplete="email" {...aria} {...form.register("email")} />}
      </Field>
      <Field id="password" label="Password" hint="At least 8 characters." error={errors.password?.message}>
        {(aria) => <Input type="password" autoComplete="new-password" {...aria} {...form.register("password")} />}
      </Field>
      <Field id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        {(aria) => <Input type="password" autoComplete="new-password" {...aria} {...form.register("confirmPassword")} />}
      </Field>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [done, setDone] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });
  const { submit, pending, formError } = useActionForm(form, requestPasswordReset, {
    onSuccess: (_d, message) => setDone(message ?? "Check your email."),
  });
  if (done) return <CheckEmail message={done} />;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field id="email" label="Email" error={form.formState.errors.email?.message}>
        {(aria) => <Input type="email" autoComplete="email" {...aria} {...form.register("email")} />}
      </Field>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
      <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm() {
  const form = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: "", confirmPassword: "" } });
  const { submit, pending, formError } = useActionForm(form, updatePassword);
  const { errors } = form.formState;
  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field id="password" label="New password" hint="At least 8 characters." error={errors.password?.message}>
        {(aria) => <Input type="password" autoComplete="new-password" {...aria} {...form.register("password")} />}
      </Field>
      <Field id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        {(aria) => <Input type="password" autoComplete="new-password" {...aria} {...form.register("confirmPassword")} />}
      </Field>
      <FormError message={formError} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
