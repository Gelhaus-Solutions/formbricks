import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { ZId } from "@formbricks/types/common";
import { InvalidInputError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import type {
  TBaseFilters,
  TSegmentFilter,
  TSegmentSurveyInteractionFilter,
} from "@formbricks/types/segment";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { buildHiddenSurveyWhere } from "@/lib/survey/visibility/predicate";

/**
 * Whether segment filters read a survey hidden from the caller (ENG-6870), for the survey writes that
 * save or attach segment filters. The rest of the segment helpers went with the contacts module.
 */

/** Upper bound on ids per `IN (...)` survey lookup. */
const SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE = 200;

const isResourceFilter = (resource: TSegmentFilter | TBaseFilters): resource is TSegmentFilter =>
  (resource as TSegmentFilter).root !== undefined;

const getSegment = reactCache(async (segmentId: string) => {
  const segment = await prisma.segment.findUnique({
    where: { id: segmentId },
    select: { workspaceId: true, filters: true },
  });
  if (!segment) throw new ResourceNotFoundError("segment", segmentId);
  return { workspaceId: segment.workspaceId, filters: segment.filters as TBaseFilters };
});

/** The survey ids a `specific` survey-interaction filter names; none for `any` or a half-built node. */
const specificSurveyIdsOf = (resource: TSegmentFilter): string[] => {
  // `any` scope only reads workspace-visible surveys (see `survey-interaction.ts`).
  const { value } = resource as Partial<TSegmentSurveyInteractionFilter>;
  if (value?.surveyScope !== "specific" || !Array.isArray(value.surveyIds)) return [];
  // A value that is not an id can name no survey, and must not reach an id-validated lookup (a draft may
  // have stored one): it reads nothing, like a dangling nested segment.
  return value.surveyIds.filter((surveyId): surveyId is string => ZId.safeParse(surveyId).success);
};

/**
 * The filters of a nested segment as evaluation reads them, or `null` when it reads nothing: a dangling or
 * malformed reference matches nobody, and another workspace's segment is ignored
 * (`buildSegmentFilterWhereClause`).
 */
const getNestedSegmentFilters = async (
  segmentId: string,
  workspaceId: string
): Promise<TBaseFilters | null> => {
  try {
    const nested = await getSegment(segmentId);
    return nested.workspaceId === workspaceId ? nested.filters : null;
  } catch (error) {
    if (error instanceof ResourceNotFoundError || error instanceof ValidationError) return null;
    throw error;
  }
};

const collectReachableSurveyIds = async (
  filters: TBaseFilters,
  workspaceId: string,
  surveyIds: Set<string>,
  visitedSegmentIds: Set<string>
): Promise<void> => {
  // Draft saves skip filter validation (`updateSurveyDraft`), so every node is read defensively: a
  // half-built one names no survey.
  if (!Array.isArray(filters)) return;
  for (const filter of filters) {
    const resource = filter?.resource;
    if (Array.isArray(resource)) {
      await collectReachableSurveyIds(resource, workspaceId, surveyIds, visitedSegmentIds);
    } else if (resource && isResourceFilter(resource)) {
      await collectFromLeaf(resource, workspaceId, surveyIds, visitedSegmentIds);
    }
  }
};

const collectFromLeaf = async (
  resource: TSegmentFilter,
  workspaceId: string,
  surveyIds: Set<string>,
  visitedSegmentIds: Set<string>
): Promise<void> => {
  if (resource.root?.type === "surveyInteraction") {
    for (const surveyId of specificSurveyIdsOf(resource)) surveyIds.add(surveyId);
    return;
  }
  if (resource.root?.type !== "segment") return;

  const { segmentId } = resource.root;
  if (typeof segmentId !== "string" || visitedSegmentIds.has(segmentId)) return;
  visitedSegmentIds.add(segmentId);

  const nestedFilters = await getNestedSegmentFilters(segmentId, workspaceId);
  if (nestedFilters)
    await collectReachableSurveyIds(nestedFilters, workspaceId, surveyIds, visitedSegmentIds);
};

const findHiddenSurvey = (where: Prisma.SurveyWhereInput) =>
  prisma.survey.findFirst({ where, select: { id: true } });

/** `collectReachableSurveyIds` from the top of a tree. */
const getReachableSurveyIds = async (
  filters: TBaseFilters,
  workspaceId: string,
  segmentId?: string
): Promise<Set<string>> => {
  const reachable = new Set<string>();
  await collectReachableSurveyIds(filters, workspaceId, reachable, new Set(segmentId ? [segmentId] : []));
  return reachable;
};

/** Whether any of `surveyIds` is a survey of `workspaceId` that `buildHiddenSurveyWhere` hides from `actor`. */
const anySurveyHiddenFrom = async (
  surveyIds: ReadonlyArray<string>,
  workspaceId: string,
  hiddenSurveyWhere: Prisma.SurveyWhereInput
): Promise<boolean> => {
  for (let i = 0; i < surveyIds.length; i += SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE) {
    const batch = surveyIds.slice(i, i + SURVEY_WORKSPACE_LOOKUP_BATCH_SIZE);
    // Sequential on purpose: the first hidden survey decides, and no further query runs.
    const batchWhere: Prisma.SurveyWhereInput = { id: { in: batch }, workspaceId, AND: [hiddenSurveyWhere] };
    if (await findHiddenSurvey(batchWhere)) return true; // NOSONAR
  }
  return false;
};

/**
 * ENG-6870: whether evaluating `filters` would tell `actor` who saw, started or completed a survey hidden
 * from them, that is, whether any survey the tree names, directly or through nested segment filters, is
 * one `buildHiddenSurveyWhere` hides from `actor`. Listing a segment's contacts, or targeting a survey
 * whose responses the actor reads, is only allowed when it is not.
 *
 * An organization owner or manager sees every survey and costs no query. Otherwise it is the nested
 * segment lookups (which `getSegment`'s request cache shares with the evaluation that follows) and one
 * query per batch of ids.
 *
 * @param segmentId - the segment whose filters these are, if saved, so a self-reference is not followed
 */
export const segmentFiltersReadHiddenSurvey = async (
  filters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<boolean> => {
  const hiddenSurveyWhere = buildHiddenSurveyWhere(actor);
  if (!hiddenSurveyWhere) return false;
  const reachable = await getReachableSurveyIds(filters, workspaceId, segmentId);
  return anySurveyHiddenFrom([...reachable], workspaceId, hiddenSurveyWhere);
};

export const SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE =
  "Segment filters reference a survey you don't have access to";

/**
 * `segmentFiltersReadHiddenSurvey` for a write: a caller may only save, attach or copy survey-interaction
 * filters they could evaluate themselves.
 * @throws {InvalidInputError} When the filters read a survey hidden from the caller
 */
export const assertSegmentSurveyFiltersVisible = async (
  filters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<void> => {
  if (await segmentFiltersReadHiddenSurvey(filters, workspaceId, actor, segmentId)) {
    throw new InvalidInputError(SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE);
  }
};

/**
 * Every survey id a set of stored segments reads, nested segments followed, in one walk with one visited
 * set: each segment is read at most once however many of them share a nested chain, so the work is
 * bounded by the workspace's segments rather than by references times chain length.
 */
export const getSurveyIdsReadBySegments = async (
  segments: ReadonlyArray<{ id: string; filters: TBaseFilters }>,
  workspaceId: string
): Promise<Set<string>> => {
  const reachable = new Set<string>();
  const visited = new Set(segments.map((segment) => segment.id));
  for (const segment of segments) {
    // Sequential on purpose: the shared visited set is what keeps the walk linear.
    await collectReachableSurveyIds(segment.filters, workspaceId, reachable, visited); // NOSONAR
  }
  return reachable;
};

/** The survey ids `filters` reads that `storedFilters` did not, nested segments followed in both. */
export const getAddedSegmentSurveyIds = async (
  filters: TBaseFilters,
  storedFilters: TBaseFilters,
  workspaceId: string,
  segmentId?: string
): Promise<string[]> => {
  const [next, stored] = await Promise.all([
    getReachableSurveyIds(filters, workspaceId, segmentId),
    getReachableSurveyIds(storedFilters, workspaceId, segmentId),
  ]);
  return [...next].filter((surveyId) => !stored.has(surveyId));
};

/**
 * `assertSegmentSurveyFiltersVisible` for an edit of a tree that is already stored: only the surveys the
 * edit adds, named directly or through a nested segment it adds, must be visible to the caller. A
 * survey the stored tree already read stays, as `restoreHiddenSegmentSurveyIds` keeps it: the caller did
 * not add it, and refusing it would stop them editing anything else in a segment an administrator wrote.
 * @throws {InvalidInputError} When the edit adds a survey hidden from the caller
 */
export const assertAddedSegmentSurveyFiltersVisible = async (
  filters: TBaseFilters,
  storedFilters: TBaseFilters,
  workspaceId: string,
  actor: TSurveyActorContext,
  segmentId?: string
): Promise<void> => {
  const hiddenSurveyWhere = buildHiddenSurveyWhere(actor);
  if (!hiddenSurveyWhere) return;
  const added = await getAddedSegmentSurveyIds(filters, storedFilters, workspaceId, segmentId);
  if (await anySurveyHiddenFrom(added, workspaceId, hiddenSurveyWhere)) {
    throw new InvalidInputError(SEGMENT_FILTERS_READ_HIDDEN_SURVEY_MESSAGE);
  }
};
