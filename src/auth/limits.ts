// The numbers that texts speak of (a code's lifetime, how long an invite works, ...). They live in
// a module of their own, without imports, so the language files can use them without a cycle.

/** How long a code is valid (the same in the real project, `supabase/config.toml` and the fakes). */
export const CODE_MINUTES = 10;

/** How many digits the code in the mail has (as set in the real project and the fakes). */
export const CODE_DIGITS = 6;

/** How long an invite works (the same in the database and the fake). */
export const INVITE_DAYS = 7;

/** The longest name, as in the database. */
export const NAME_MAX = 30;

/** Most open friend invites at the same time (E2-5b). */
export const FRIEND_INVITES_OPEN = 5;

/** Most friend invites in 24 hours (E2-5b). */
export const FRIEND_INVITES_PER_DAY = 10;
