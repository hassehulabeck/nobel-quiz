import { laureateInfoFor } from "@/lib/auth/laureateNames";

/** A player's display name, with the laureate blurb underneath when the name is a laureate default. */
export function PlayerName({
  name,
  suffix = "",
}: {
  name: string;
  suffix?: string;
}) {
  const info = laureateInfoFor(name);
  return (
    <>
      {name}
      {suffix}
      {info && (
        <span className="block text-xs font-normal text-muted-foreground">
          {info}
        </span>
      )}
    </>
  );
}
