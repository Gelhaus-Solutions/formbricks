import { type TCustomCssCompiled, type TCustomCssInput } from "@formbricks/types/custom-css";
import { type TCustomCssHealthStatus } from "./lib/api-client";

/**
 * Computed by the Appearance page loader. Everything here mirrors the server's own checks, which stay
 * authoritative.
 */
export interface TWorkspaceCustomCssAccess {
  /** Organization owner or manager (D15). */
  canEdit: boolean;
  /** Self-hosted only: the workspace's Custom Head Scripts carry page styles. */
  hasHeadScriptStyles: boolean;
}

/** Computed by the survey editor page loader. */
export interface TSurveyCustomCssEditorConfig {
  /** Self-hosted only: the workspace's or survey's Custom Head Scripts carry page styles. */
  hasHeadScriptStyles: boolean;
  /** Health of the survey's saved CSS. */
  surveyStatus: TCustomCssHealthStatus;
  /** The inherited workspace CSS: source to show read-only, compiled output for the preview. */
  workspace: {
    source: TCustomCssInput | null;
    compiled: TCustomCssCompiled | null;
    status: TCustomCssHealthStatus;
  };
}
