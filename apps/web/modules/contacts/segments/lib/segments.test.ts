import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import {
  ALL_SEGMENT_SURVEY_REFS,
  getExistingWorkspaceSurveyIds,
  getSegments,
  getSurveyWorkspaceIdMap,
  transformPrismaSegment,
} from "./segments";

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({
  prisma: { segment: { findMany: vi.fn() }, survey: { findMany: vi.fn() } },
}));

const row = {
  id: "segment-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  title: "VIPs",
  description: null,
  isPrivate: false,
  filters: [],
  workspaceId: "workspace-1",
  surveys: [
    { id: "s1", name: "Live", status: "inProgress" },
    { id: "s2", name: "Done", status: "completed" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transformPrismaSegment", () => {
  test("lists the survey ids and splits the surveys by status", () => {
    expect(transformPrismaSegment(row as never)).toEqual({
      ...row,
      surveys: ["s1", "s2"],
      activeSurveys: [{ id: "s1", name: "Live" }],
      inactiveSurveys: [{ id: "s2", name: "Done" }],
    });
  });
});

describe("getSegments", () => {
  test("reads every segment of the workspace, scoping survey refs by the given filter", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValueOnce([row] as never);
    const visible = { visibility: "workspace" } as Prisma.SurveyWhereInput;

    const segments = await getSegments("workspace-1", visible);

    expect(segments.map((segment) => segment.id)).toEqual(["segment-1"]);
    const args = vi.mocked(prisma.segment.findMany).mock.calls[0][0];
    expect(args?.where).toEqual({ workspaceId: "workspace-1" });
    expect((args?.select as { surveys: { where: unknown } }).surveys.where).toBe(visible);
  });

  test("keeps every survey ref with ALL_SEGMENT_SURVEY_REFS", async () => {
    vi.mocked(prisma.segment.findMany).mockResolvedValueOnce([] as never);

    await getSegments("workspace-1", ALL_SEGMENT_SURVEY_REFS);

    const args = vi.mocked(prisma.segment.findMany).mock.calls[0][0];
    expect((args?.select as { surveys: { where: unknown } }).surveys.where).toEqual({});
  });

  test("turns a Prisma request error into a DatabaseError", async () => {
    vi.mocked(prisma.segment.findMany).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("boom", { code: "P2024", clientVersion: "0.0.0" })
    );

    await expect(getSegments("workspace-1", {})).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe("getExistingWorkspaceSurveyIds", () => {
  test("looks up the distinct ids inside the workspace and the visibility filter", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([{ id: "s1" }] as never);
    const visible = { visibility: "workspace" } as Prisma.SurveyWhereInput;

    await expect(getExistingWorkspaceSurveyIds("workspace-1", ["s1", "s9", "s1"], visible)).resolves.toEqual(
      new Set(["s1"])
    );
    expect(prisma.survey.findMany).toHaveBeenCalledWith({
      where: { AND: [{ workspaceId: "workspace-1", id: { in: ["s1", "s9"] } }, visible] },
      select: { id: true },
    });
  });

  test("skips the query without ids", async () => {
    await expect(getExistingWorkspaceSurveyIds("workspace-1", [], {})).resolves.toEqual(new Set());
    expect(prisma.survey.findMany).not.toHaveBeenCalled();
  });
});

describe("getSurveyWorkspaceIdMap", () => {
  test("maps each existing survey to its workspace", async () => {
    vi.mocked(prisma.survey.findMany).mockResolvedValueOnce([
      { id: "s1", workspaceId: "workspace-1" },
      { id: "s2", workspaceId: "workspace-2" },
    ] as never);

    const map = await getSurveyWorkspaceIdMap(["s1", "s2", "s3"]);

    expect(map.get("s1")).toBe("workspace-1");
    expect(map.get("s2")).toBe("workspace-2");
    expect(map.has("s3")).toBe(false);
  });

  test("skips the query without ids", async () => {
    await expect(getSurveyWorkspaceIdMap([])).resolves.toEqual(new Map());
    expect(prisma.survey.findMany).not.toHaveBeenCalled();
  });
});
