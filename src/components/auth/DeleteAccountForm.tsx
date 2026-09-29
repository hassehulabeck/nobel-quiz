"use client";

import { useActionState } from "react";
import { deleteAccount, type FormState } from "@/lib/auth/actions";
import { FormError } from "./FormError";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    deleteAccount,
    null
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-destructive bg-destructive-tint p-4"
    >
      <p className="text-sm font-medium text-destructive">
        This permanently removes your account, your email address, and every
        answer and result tied to it. This cannot be undone.
      </p>
      <label className="flex flex-col gap-1">
        <span>Confirm your password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="field-input"
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirmDelete" required className="mt-1" />
        <span>I understand this is permanent and cannot be undone.</span>
      </label>
      <FormError state={state} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-destructive px-4 py-2 font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete my account"}
      </button>
    </form>
  );
}
