import "server-only";
import type { BetterAuthOptions } from "better-auth";
import { LOCAL_CREDENTIAL_ISSUER } from "./credential-issuer-heal";
import { enforceCredentialSignupBackstop } from "./credential-signup-backstop";

/**
 * Better Auth's user and account create hooks. Every account GForms creates is a password (credential)
 * account: there are no SSO providers until GFORMS-14 rebuilds them. Better Auth merges the returned
 * `{ data }` into the row it inserts, and `false` blocks the insert.
 */
export const authDatabaseHooks = {
  user: {
    create: {
      // The closed-sign-up backstop, and the fresh-instance bootstrap admin marker it decides on (see
      // credential-signup-backstop.ts). `image` is cleared on every insert: `User` has no image column
      // (20250813071701_remove_user_image_url) while Better Auth's model still declares one, and
      // `transformInput` drops an undefined field before Prisma sees it. The schema contract test holds
      // this file to that.
      before: async (user) => {
        const backstop = await enforceCredentialSignupBackstop(user.email);
        if (backstop === false) return false;
        return { data: { ...backstop?.data, image: undefined } };
      },
    },
  },
  account: {
    create: {
      // Better Auth 1.7.3 stopped writing `issuer`, but 1.7.0 keys accounts on it, so a credential
      // account is created with the issuer credential-issuer-heal.ts repairs NULL rows to. Keeps a
      // rollback to 1.7.0 able to find the account.
      before: (account) =>
        Promise.resolve(
          account.providerId === "credential" ? { data: { issuer: LOCAL_CREDENTIAL_ISSUER } } : undefined
        ),
    },
  },
} satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;
