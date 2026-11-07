import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getContactAttributeKeys } from "./contact-attribute-keys";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: { contactAttributeKey: { findMany: vi.fn() } } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getContactAttributeKeys", () => {
  test("reads the workspace's keys, oldest first", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValueOnce([{ id: "key-1" }] as never);

    await expect(getContactAttributeKeys("workspace-1")).resolves.toEqual([{ id: "key-1" }]);
    const args = vi.mocked(prisma.contactAttributeKey.findMany).mock.calls[0][0];
    expect(args?.where).toEqual({ workspaceId: "workspace-1" });
    expect(args?.orderBy).toEqual([{ createdAt: "asc" }, { id: "asc" }]);
  });

  test("turns a Prisma request error into a DatabaseError", async () => {
    vi.mocked(prisma.contactAttributeKey.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2024", clientVersion: "0.0.0" })
    );

    await expect(getContactAttributeKeys("workspace-2")).rejects.toBeInstanceOf(DatabaseError);
  });
});
