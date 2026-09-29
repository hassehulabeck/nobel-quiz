"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/lib/auth/actions";
import { FormError } from "./FormError";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    login,
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
          autoComplete="current-password"
          className="field-input"
        />
      </label>
      <FormError state={state} />
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
