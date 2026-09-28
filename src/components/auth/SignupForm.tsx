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
          className="border rounded px-3 py-2"
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
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>Confirm password</span>
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          autoComplete="new-password"
          className="border rounded px-3 py-2"
        />
      </label>
      <FormError state={state} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Creating account..." : "Sign up"}
      </button>
    </form>
  );
}
