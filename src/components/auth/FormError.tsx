import type { FormState } from "@/lib/auth/actions";

export function FormError({ state }: { state: FormState }) {
  if (!state || !("error" in state)) return null;
  return (
    <p
      role="alert"
      className="rounded-md bg-destructive-tint px-3 py-2 text-sm font-medium text-destructive"
    >
      {state.error}
    </p>
  );
}
