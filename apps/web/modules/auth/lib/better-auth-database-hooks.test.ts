import { beforeEach, describe, expect, test, vi } from "vitest";
import { BootstrapAdminMarker } from "@formbricks/database/prisma";
import { authDatabaseHooks } from "./better-auth-database-hooks";
import { enforceCredentialSignupBackstop } from "./credential-signup-backstop";

vi.mock("server-only", () => ({}));
vi.mock("./credential-signup-backstop", () => ({ enforceCredentialSignupBackstop: vi.fn() }));
vi.mock("./credential-issuer-heal", () => ({ LOCAL_CREDENTIAL_ISSUER: "local:credential" }));

const user = {
  id: "user_1",
  email: "ada@example.com",
  emailVerified: false,
  name: "Ada",
  image: "https://example.com/ada.png",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const account = (providerId: string) => ({
  id: "account_1",
  userId: "user_1",
  accountId: "user_1",
  providerId,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const createUser = (input: typeof user) => authDatabaseHooks.user.create.before(input);
const createAccount = (input: ReturnType<typeof account>) => authDatabaseHooks.account.create.before(input);

describe("authDatabaseHooks", () => {
  beforeEach(() => {
    vi.mocked(enforceCredentialSignupBackstop).mockReset();
  });

  test("blocks the user insert when the sign-up backstop refuses it", async () => {
    vi.mocked(enforceCredentialSignupBackstop).mockResolvedValue(false);

    await expect(createUser(user)).resolves.toBe(false);
    expect(enforceCredentialSignupBackstop).toHaveBeenCalledWith("ada@example.com");
  });

  test("clears the image Prisma has no column for on an admitted sign-up", async () => {
    vi.mocked(enforceCredentialSignupBackstop).mockResolvedValue(undefined);

    await expect(createUser(user)).resolves.toEqual({ data: { image: undefined } });
  });

  test("keeps the fresh-instance bootstrap marker the backstop decided on", async () => {
    vi.mocked(enforceCredentialSignupBackstop).mockResolvedValue({
      data: { isBootstrapAdmin: BootstrapAdminMarker.bootstrapAdmin },
    });

    await expect(createUser(user)).resolves.toEqual({
      data: { isBootstrapAdmin: BootstrapAdminMarker.bootstrapAdmin, image: undefined },
    });
  });

  test("writes the local issuer on a credential account and leaves any other account alone", async () => {
    await expect(createAccount(account("credential"))).resolves.toEqual({
      data: { issuer: "local:credential" },
    });
    await expect(createAccount(account("github"))).resolves.toBeUndefined();
  });
});
