import { prisma } from "@/lib/prisma";

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

/** Generates a unique, floral-themed display name, decoupled from the user's email (see METHODS.md). */
export async function generateUniqueDisplayName(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const base = `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`;
    const candidate =
      attempt < 10 ? base : `${base} ${Math.floor(Math.random() * 10000)}`;

    const existing = await prisma.user.findUnique({
      where: { displayName: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  throw new Error("Could not generate a unique display name after 20 attempts");
}
