"use client";

import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/lib/auth/actions";
import { FormError } from "./FormError";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    requestPasswordReset,
    null
  );

  if (state && "success" in state) {
    return (
      <p role="status" className="rounded-md bg-accent-tint px-3 py-2 text-accent-tint-foreground">
        If an account exists for that email address, a password reset link has
        been sent. Check your inbox.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span>Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="field-input"
        />
      </label>
      <FormError state={state} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
