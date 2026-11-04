import type { createAuthMiddleware } from "better-auth/api";

/**
 * The context Better Auth hands a `before` or `after` hook, taken from the handler `createAuthMiddleware`
 * accepts (GFORMS-3 seam), so the hook helpers here do not depend on the Enterprise SSO module.
 */
export type AuthHookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];
