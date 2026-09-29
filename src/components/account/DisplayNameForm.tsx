"use client";

import { useActionState } from "react";
import { updateDisplayName, type FormState } from "@/lib/auth/actions";
import { FormError } from "@/components/auth/FormError";
import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_MIN,
} from "@/lib/auth/displayNameRules";

export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateDisplayName,
    null
  );

  return (
    <form action={formAction} className="card flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span>Display name</span>
        <input
          type="text"
          name="displayName"
          defaultValue={currentName}
          required
          minLength={DISPLAY_NAME_MIN}
          maxLength={DISPLAY_NAME_MAX}
          autoComplete="off"
          className="field-input"
        />
        <span className="text-sm text-muted-foreground">
          {DISPLAY_NAME_MIN}–{DISPLAY_NAME_MAX} characters: letters, numbers,
          spaces, dots, apostrophes and hyphens. Other players see this name on
          the leaderboard, never your email.
        </span>
      </label>
      <FormError state={state} />
      {state && "success" in state && (
        <p
          role="status"
          className="rounded-md bg-accent-tint px-3 py-2 text-sm font-medium text-accent-tint-foreground"
        >
          Name updated.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          name="intent"
          value="custom"
          disabled={pending}
          className="btn-primary"
        >
          Save name
        </button>
        <button
          type="submit"
          name="intent"
          value="random"
          disabled={pending}
          formNoValidate
          className="rounded-md border border-border px-4 py-2 font-medium hover:bg-warning-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          Give me a random laureate
        </button>
      </div>
    </form>
  );
}
