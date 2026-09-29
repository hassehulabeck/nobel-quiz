/**
 * Cookie remembering that the player hid the "How the game works" panel.
 * Lives in a plain module (not in the "use client" RulesPanel file) because a
 * server component importing a non-component export from a client module gets
 * a client reference, not the string — the cookie lookup would silently never
 * match.
 */
export const RULES_HIDDEN_COOKIE = "rules-hidden";
