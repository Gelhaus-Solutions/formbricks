import type { TUserLocale } from "@formbricks/types/user";

/**
 * The locale the app falls back to, and the one every string is written in first. Client-safe, unlike
 * `@/lib/constants`, which re-exports it for server code.
 */
export const DEFAULT_LOCALE = "en-US" satisfies TUserLocale;

/**
 * The locales the app's own strings ship in (`apps/web/locales`). GForms ships English only; a user
 * locale stored before that still parses (`ZUserLocale`) and reads the English strings.
 */
export const AVAILABLE_LOCALES: TUserLocale[] = [DEFAULT_LOCALE];

/**
 * The locale the app's own strings are read in: the given one when the app ships it, English
 * otherwise. A user locale stored before GForms dropped the other languages still parses, so every
 * read of a locale file goes through here instead of trusting the stored value.
 */
export const toAppLocale = (locale: string | null | undefined): TUserLocale =>
  AVAILABLE_LOCALES.find((available) => available === locale) ?? DEFAULT_LOCALE;
