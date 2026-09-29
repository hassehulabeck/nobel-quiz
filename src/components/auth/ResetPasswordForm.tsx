"use client";

import { useActionState } from "react";
import { resetPassword, type FormState } from "@/lib/auth/actions";
import { FormError } from "./FormError";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    resetPassword,
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1">
        <span>New password</span>
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
        <span>Confirm new password</span>
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
        {pending ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}
