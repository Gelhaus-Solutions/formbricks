/**
 * Helpers for the Focus link-survey layout: list choices get a letter (A, B, C...) that a key press picks,
 * the way the layout's badges show it. The letter lives in a `data-fb-focus-key` attribute on the choice
 * row and on its control, so the stylesheet and the key handler always agree on which letter is which.
 */

export const FOCUS_KEY_ATTRIBUTE = "data-fb-focus-key";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * A lettered choice is a row of a single- or multi-select list: a hooked option that carries a radio or
 * checkbox and its painted control. Rating and NPS steps (no control), ranking items (no input) and
 * matrix cells (inside a table) keep their own look.
 */
const isListChoice = (option: Element): boolean =>
  option.closest("table") === null &&
  option.querySelector('[data-fb-part="option-control"]') !== null &&
  option.querySelector('input[type="radio"], input[type="checkbox"]') !== null;

/** The list choices of one group, in reading order, that belong to the group itself (not a nested one). */
const getGroupChoices = (group: Element): HTMLElement[] =>
  Array.from(group.querySelectorAll<HTMLElement>('[data-fb-part="option"]')).filter(
    (option) => option.closest("fieldset") === group && isListChoice(option)
  );

const getChoiceGroups = (content: Element): Element[] =>
  Array.from(content.querySelectorAll("fieldset")).filter((group) => getGroupChoices(group).length > 0);

/** Letters every list choice in `content`, per group, and clears letters a re-render left behind. */
export const markFocusChoices = (content: Element): void => {
  const lettered = new Set<Element>();
  for (const group of getChoiceGroups(content)) {
    getGroupChoices(group).forEach((option, index) => {
      if (index >= LETTERS.length) return;
      const letter = LETTERS[index];
      const control = option.querySelector('[data-fb-part="option-control"]');
      for (const node of [option, control]) {
        if (!node) continue;
        lettered.add(node);
        if (node.getAttribute(FOCUS_KEY_ATTRIBUTE) !== letter) node.setAttribute(FOCUS_KEY_ATTRIBUTE, letter);
      }
    });
  }
  for (const node of Array.from(content.querySelectorAll(`[${FOCUS_KEY_ATTRIBUTE}]`))) {
    if (!lettered.has(node)) node.removeAttribute(FOCUS_KEY_ATTRIBUTE);
  }
};

/**
 * The choice a key press names: its letter within the group the respondent is in (the one holding the
 * focused element), else within the first lettered group on the screen. Null for any other key.
 */
export const getFocusChoiceForKey = (
  content: Element,
  key: string,
  origin: Element | null
): HTMLElement | null => {
  if (key.length !== 1) return null;
  const letter = key.toUpperCase();
  if (!LETTERS.includes(letter)) return null;
  const groups = getChoiceGroups(content);
  const originGroup = origin ? groups.find((group) => group.contains(origin)) : undefined;
  const group = originGroup ?? groups[0];
  if (!group) return null;
  return getGroupChoices(group).find((option) => option.getAttribute(FOCUS_KEY_ATTRIBUTE) === letter) ?? null;
};

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
