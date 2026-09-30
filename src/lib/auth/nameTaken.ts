import { prisma } from "@/lib/prisma";

/**
 * Display names are unique (case-insensitively) across registered users and
 * guest entries, since both appear on the same leaderboard.
 */
export async function isDisplayNameTaken(
  name: string,
  excludeUserId?: string
): Promise<boolean> {
  const [user, guest] = await Promise.all([
    prisma.user.findFirst({
      where: {
        displayName: { equals: name, mode: "insensitive" },
        ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
      },
      select: { id: true },
    }),
    prisma.guestPlayer.findFirst({
      where: { displayName: { equals: name, mode: "insensitive" } },
      select: { id: true },
    }),
  ]);
  return !!(user || guest);
}
