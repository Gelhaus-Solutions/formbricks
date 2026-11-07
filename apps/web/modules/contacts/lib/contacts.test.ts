import { describe, expect, test } from "vitest";
import { buildContactWhereClause } from "./contacts";

describe("buildContactWhereClause", () => {
  test("scopes to the workspace without a search", () => {
    expect(buildContactWhereClause("workspace-1")).toEqual({ workspaceId: "workspace-1" });
    expect(buildContactWhereClause("workspace-1", "")).toEqual({ workspaceId: "workspace-1" });
  });

  test("matches the id or any attribute value, ignoring case", () => {
    expect(buildContactWhereClause("workspace-1", "ada")).toEqual({
      workspaceId: "workspace-1",
      OR: [
        { attributes: { some: { value: { contains: "ada", mode: "insensitive" } } } },
        { id: { contains: "ada", mode: "insensitive" } },
      ],
    });
  });
});
