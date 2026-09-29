/**
 * Former Nobel laureates used as default display names, each with the short
 * line shown next to the name on the leaderboard. Only deceased laureates are
 * used, so no living person's name is handed out to strangers as a handle.
 * `info` follows the official prize year/category; scripts/verify-laureate-names.ts
 * checks every entry against api.nobelprize.org.
 */
export type Laureate = { name: string; info: string };

export const LAUREATES: readonly Laureate[] = [
  { name: "Marie Curie", info: "Physics 1903, Chemistry 1911" },
  { name: "Wilhelm Röntgen", info: "Physics 1901" },
  { name: "Hendrik Lorentz", info: "Physics 1902" },
  { name: "Max Planck", info: "Physics 1918" },
  { name: "Albert Einstein", info: "Physics 1921" },
  { name: "Niels Bohr", info: "Physics 1922" },
  { name: "C. V. Raman", info: "Physics 1930" },
  { name: "Werner Heisenberg", info: "Physics 1932" },
  { name: "Erwin Schrödinger", info: "Physics 1933" },
  { name: "Paul Dirac", info: "Physics 1933" },
  { name: "Enrico Fermi", info: "Physics 1938" },
  { name: "Maria Goeppert Mayer", info: "Physics 1963" },
  { name: "Richard Feynman", info: "Physics 1965" },
  { name: "Subrahmanyan Chandrasekhar", info: "Physics 1983" },
  { name: "Ernest Rutherford", info: "Chemistry 1908" },
  { name: "Irène Joliot-Curie", info: "Chemistry 1935" },
  { name: "Linus Pauling", info: "Chemistry 1954, Peace 1962" },
  { name: "Frederick Sanger", info: "Chemistry 1958, 1980" },
  { name: "Dorothy Hodgkin", info: "Chemistry 1964" },
  { name: "Ivan Pavlov", info: "Medicine 1904" },
  { name: "Robert Koch", info: "Medicine 1905" },
  { name: "Santiago Ramón y Cajal", info: "Medicine 1906" },
  { name: "Alexander Fleming", info: "Medicine 1945" },
  { name: "Gerty Cori", info: "Medicine 1947" },
  { name: "Barbara McClintock", info: "Medicine 1983" },
  { name: "Rita Levi-Montalcini", info: "Medicine 1986" },
  { name: "Gertrude Elion", info: "Medicine 1988" },
  { name: "Selma Lagerlöf", info: "Literature 1909" },
  { name: "Rabindranath Tagore", info: "Literature 1913" },
  { name: "Sigrid Undset", info: "Literature 1928" },
  { name: "Gabriela Mistral", info: "Literature 1945" },
  { name: "Ernest Hemingway", info: "Literature 1954" },
  { name: "Albert Camus", info: "Literature 1957" },
  { name: "Samuel Beckett", info: "Literature 1969" },
  { name: "Pablo Neruda", info: "Literature 1971" },
  { name: "Harry Martinson", info: "Literature 1974" },
  { name: "Gabriel García Márquez", info: "Literature 1982" },
  { name: "Naguib Mahfouz", info: "Literature 1988" },
  { name: "Nadine Gordimer", info: "Literature 1991" },
  { name: "Derek Walcott", info: "Literature 1992" },
  { name: "Toni Morrison", info: "Literature 1993" },
  { name: "Seamus Heaney", info: "Literature 1995" },
  { name: "Wisława Szymborska", info: "Literature 1996" },
  { name: "Doris Lessing", info: "Literature 2007" },
  { name: "Tomas Tranströmer", info: "Literature 2011" },
  { name: "Alice Munro", info: "Literature 2013" },
  { name: "Henry Dunant", info: "Peace 1901" },
  { name: "Bertha von Suttner", info: "Peace 1905" },
  { name: "Jane Addams", info: "Peace 1931" },
  { name: "Albert Schweitzer", info: "Peace 1952" },
  { name: "Dag Hammarskjöld", info: "Peace 1961" },
  { name: "Martin Luther King Jr.", info: "Peace 1964" },
  { name: "Mother Teresa", info: "Peace 1979" },
  { name: "Desmond Tutu", info: "Peace 1984" },
  { name: "Elie Wiesel", info: "Peace 1986" },
  { name: "Nelson Mandela", info: "Peace 1993" },
  { name: "Kofi Annan", info: "Peace 2001" },
  { name: "Jimmy Carter", info: "Peace 2002" },
  { name: "Wangari Maathai", info: "Peace 2004" },
  { name: "Ragnar Frisch", info: "Economics 1969" },
  { name: "Paul Samuelson", info: "Economics 1970" },
  { name: "Kenneth Arrow", info: "Economics 1972" },
  { name: "Friedrich Hayek", info: "Economics 1974" },
  { name: "Milton Friedman", info: "Economics 1976" },
  { name: "Herbert Simon", info: "Economics 1978" },
  { name: "Ronald Coase", info: "Economics 1991" },
  { name: "John Nash", info: "Economics 1994" },
  { name: "Elinor Ostrom", info: "Economics 2009" },
];

const infoByLowerName = new Map(
  LAUREATES.map((l) => [l.name.toLowerCase(), l.info])
);

/** The laureate blurb for a display name, or undefined for any other name. */
export function laureateInfoFor(displayName: string): string | undefined {
  return infoByLowerName.get(displayName.toLowerCase());
}

/** True if `name` is a laureate default (case-insensitive). Custom names may not be one. */
export function isLaureateName(name: string): boolean {
  return infoByLowerName.has(name.toLowerCase());
}
