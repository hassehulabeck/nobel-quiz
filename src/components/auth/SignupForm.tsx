"use client";

import { useActionState } from "react";
import { signup, type FormState } from "@/lib/auth/actions";
import { FormError } from "./FormError";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    signup,
    null
  );

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
      <label className="flex flex-col gap-1">
        <span>Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          aria-describedby="password-hint"
          className="field-input"
        />
        <span id="password-hint" className="text-xs text-muted-foreground">
          At least 8 characters.
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span>Confirm password</span>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="field-input"
        />
      </label>
      <FormError state={state} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Creating account..." : "Sign up"}
      </button>
    </form>
  );
}
