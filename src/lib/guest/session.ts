import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const GUEST_COOKIE_NAME = "nq_guest";
const GUEST_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60;

export async function setGuestCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_S,
  });
}

export async function clearGuestCookie() {
  (await cookies()).delete(GUEST_COOKIE_NAME);
}

/** The guest entry this browser already made, or null. Safe in Server Components. */
export async function getCurrentGuest() {
  const token = (await cookies()).get(GUEST_COOKIE_NAME)?.value;
  if (!token) return null;
  return prisma.guestPlayer.findUnique({ where: { token } });
}
