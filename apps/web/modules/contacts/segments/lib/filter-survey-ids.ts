import type {
  TBaseFilters,
  TSegmentFilter,
  TSegmentSurveyInteractionFilter,
} from "@formbricks/types/segment";

const isLeaf = (resource: TSegmentFilter | TBaseFilters): resource is TSegmentFilter =>
  !Array.isArray(resource);

const isSurveyInteraction = (filter: TSegmentFilter): filter is TSegmentSurveyInteractionFilter =>
  filter.root.type === "surveyInteraction";

const surveyIdsOf = (filter: TSegmentFilter): string[] =>
  isSurveyInteraction(filter) ? filter.value.surveyIds : [];

/** Every survey id the segment's survey-interaction filters name, each once, in tree order. */
export const collectSegmentFilterSurveyIds = (filters: TBaseFilters): string[] => {
  const ids = new Set<string>();
  const walk = (nodes: TBaseFilters) => {
    for (const node of nodes) {
      if (isLeaf(node.resource)) {
        for (const id of surveyIdsOf(node.resource)) ids.add(id);
      } else {
        walk(node.resource);
      }
    }
  };
  walk(filters);
  return [...ids];
};

/** A copy of the filters whose survey-interaction filters only name surveys in `visibleSurveyIds`. */
export const redactSegmentFilterSurveyIds = (
  filters: TBaseFilters,
  visibleSurveyIds: ReadonlySet<string>
): TBaseFilters =>
  filters.map((node) => {
    if (!isLeaf(node.resource)) {
      return { ...node, resource: redactSegmentFilterSurveyIds(node.resource, visibleSurveyIds) };
    }
    const filter = node.resource;
    if (!isSurveyInteraction(filter)) return node;
    return {
      ...node,
      resource: {
        ...filter,
        value: {
          ...filter.value,
          surveyIds: filter.value.surveyIds.filter((id) => visibleSurveyIds.has(id)),
        },
      },
    };
  });
