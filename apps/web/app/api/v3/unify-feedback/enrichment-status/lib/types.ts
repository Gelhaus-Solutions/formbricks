/**
 * What the enrichment-status read returns (GFORMS-3): one progress row per Hub enrichment, in the
 * Hub's order, summed over the workspace's feedback directories.
 */

export const ENRICHMENT_KINDS = ["translation", "sentiment", "emotions"] as const;

export type TEnrichmentKind = (typeof ENRICHMENT_KINDS)[number];

export type TEnrichmentProgress = {
  kind: TEnrichmentKind;
  eligible: number;
  done: number;
  failedTerminal: number;
  pending: number;
};

export type TEnrichmentStatusResponse = {
  enrichments: TEnrichmentProgress[];
  /** True when every directory's Hub read failed, so there is nothing to show. */
  unavailable: boolean;
};
