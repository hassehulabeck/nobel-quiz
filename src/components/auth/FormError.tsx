import type { FormState } from "@/lib/auth/actions";

export function FormError({ state }: { state: FormState }) {
  if (!state || !("error" in state)) return null;
  return (
    <p role="alert" className="text-sm text-red-700">
      {state.error}
    </p>
  );
}
