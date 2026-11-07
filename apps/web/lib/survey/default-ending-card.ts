/**
 * The formbricks.com link Formbricks put on the default ending card's button. New surveys no longer get
 * a button (GFORMS-8), but surveys saved before still carry this link, so the external-URL gate keeps
 * exempting it. The match is exact on purpose: any other path, host or query string is a user-chosen
 * link and stays gated.
 */
export const DEFAULT_ENDING_CARD_BUTTON_LINK =
  "https://formbricks.com?utm_source=formbricks-app&utm_medium=survey&utm_campaign=default_ending_cta";

export const isDefaultEndingCardButtonLink = (link: string | undefined | null): boolean =>
  link === DEFAULT_ENDING_CARD_BUTTON_LINK;
