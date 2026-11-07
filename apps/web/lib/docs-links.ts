/**
 * Where the dashboard's documentation links point. Unset until GForms has a docs host of its own (D13), so
 * every docs link and "Learn more" button is hidden rather than sending people to formbricks.com.
 *
 * To show them again, set this to the host's base URL without a trailing slash. Each path given to
 * `getDocsUrl` is the page's path under `docs/` in this repository, without the `.mdx`.
 *
 * The cast keeps the type `string | null`; a bare `null` would let TypeScript treat every link as dead code.
 */
export const DOCS_BASE_URL = null as string | null;

export const getDocsUrl = (path: string): string | null =>
  DOCS_BASE_URL === null ? null : `${DOCS_BASE_URL}${path}`;
