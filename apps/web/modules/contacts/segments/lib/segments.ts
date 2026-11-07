import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import type { TSegmentWithSurveyRefs } from "@formbricks/types/segment";

/**
 * GForms' segment reads (GFORMS-3 seam), written from the Prisma schema, the call sites and the AGPL
 * types. The contacts rebuild (GFORMS-18) builds on them. Every caller already checks the `contacts`
 * flag, which is off.
 */

/** What a segment read selects. Callers narrow `surveys` with their own `where`. */
export const selectSegment = {
  id: true,
  createdAt: true,
  updatedAt: true,
  title: true,
  description: true,
  isPrivate: true,
  filters: true,
  workspaceId: true,
  surveys: { select: { id: true, name: true, status: true } },
} satisfies Prisma.SegmentSelect;

export type TPrismaSegment = Prisma.SegmentGetPayload<{ select: typeof selectSegment }>;

/** A survey filter that keeps every survey a segment is attached to. */
export const ALL_SEGMENT_SURVEY_REFS: Prisma.SurveyWhereInput = {};

/** The segment with its survey ids, and its surveys split into in progress and every other status. */
export const transformPrismaSegment = ({ surveys, ...segment }: TPrismaSegment): TSegmentWithSurveyRefs => ({
  ...segment,
  surveys: surveys.map((survey) => survey.id),
  activeSurveys: surveys
    .filter((survey) => survey.status === "inProgress")
    .map((survey) => ({ id: survey.id, name: survey.name })),
  inactiveSurveys: surveys
    .filter((survey) => survey.status !== "inProgress")
    .map((survey) => ({ id: survey.id, name: survey.name })),
});

const rethrowAsDatabaseError = (error: unknown): never => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    throw new DatabaseError(error.message);
  }
  throw error;
};

/**
 * The workspace's segments, private ones included, newest first. Their survey references only name
 * surveys matching `visibleSurveyWhere`.
 */
export const getSegments = async (
  workspaceId: string,
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<TSegmentWithSurveyRefs[]> => {
  try {
    const rows = await prisma.segment.findMany({
      where: { workspaceId },
      select: { ...selectSegment, surveys: { ...selectSegment.surveys, where: visibleSurveyWhere } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(transformPrismaSegment);
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
};

/** Which of `surveyIds` are surveys of the workspace that match `visibleSurveyWhere`. */
export const getExistingWorkspaceSurveyIds = async (
  workspaceId: string,
  surveyIds: readonly string[],
  visibleSurveyWhere: Prisma.SurveyWhereInput
): Promise<Set<string>> => {
  const ids = [...new Set(surveyIds)];
  if (ids.length === 0) return new Set();

  try {
    const surveys = await prisma.survey.findMany({
      where: { AND: [{ workspaceId, id: { in: ids } }, visibleSurveyWhere] },
      select: { id: true },
    });
    return new Set(surveys.map((survey) => survey.id));
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
};

/** The workspace of each survey in `surveyIds` that exists. */
export const getSurveyWorkspaceIdMap = async (surveyIds: readonly string[]): Promise<Map<string, string>> => {
  const ids = [...new Set(surveyIds)];
  if (ids.length === 0) return new Map();

  try {
    const surveys = await prisma.survey.findMany({
      where: { id: { in: ids } },
      select: { id: true, workspaceId: true },
    });
    return new Map(surveys.map((survey) => [survey.id, survey.workspaceId]));
  } catch (error) {
    return rethrowAsDatabaseError(error);
  }
};
