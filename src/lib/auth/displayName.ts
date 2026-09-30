import { prisma } from "@/lib/prisma";
import { LAUREATES } from "./laureateNames";
import { isDisplayNameTaken } from "./nameTaken";

const ADJECTIVES = [
  "Blooming",
  "Cheerful",
  "Golden",
  "Sunny",
  "Playful",
  "Radiant",
  "Wandering",
  "Dazzling",
  "Merry",
  "Curious",
  "Gentle",
  "Vivid",
  "Whimsical",
  "Breezy",
  "Sparkling",
];

const NOUNS = [
  "Marigold",
  "Sunflower",
  "Poppy",
  "Daffodil",
  "Peony",
  "Tulip",
  "Daisy",
  "Larkspur",
  "Zinnia",
  "Iris",
  "Violet",
  "Magnolia",
  "Lotus",
  "Orchid",
  "Wisteria",
];

function randomFrom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Picks a laureate name nobody is using yet, or null when they are all taken.
 * Names are compared case-insensitively, matching how renames are checked.
 */
async function pickFreeLaureateName(): Promise<string | null> {
  const where = {
    displayName: { in: LAUREATES.map((l) => l.name), mode: "insensitive" },
  } as const;
  const [users, guests] = await Promise.all([
    prisma.user.findMany({ where, select: { displayName: true } }),
    prisma.guestPlayer.findMany({ where, select: { displayName: true } }),
  ]);
  const takenLower = new Set(
    [...users, ...guests].map((u) => u.displayName.toLowerCase())
  );
  const free = LAUREATES.filter((l) => !takenLower.has(l.name.toLowerCase()));
  return free.length > 0 ? randomFrom(free).name : null;
}

/**
 * Generates a unique display name, decoupled from the user's email (see
 * METHODS.md): a random former laureate while any are free, otherwise the
 * floral adjective+noun scheme the game launched with.
 */
export async function generateUniqueDisplayName(): Promise<string> {
  const laureate = await pickFreeLaureateName();
  if (laureate) return laureate;

  for (let attempt = 0; attempt < 20; attempt++) {
    const base = `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`;
    const candidate =
      attempt < 10 ? base : `${base} ${Math.floor(Math.random() * 10000)}`;

    if (!(await isDisplayNameTaken(candidate))) return candidate;
  }

  throw new Error("Could not generate a unique display name after 20 attempts");
}
