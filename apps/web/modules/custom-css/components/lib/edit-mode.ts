import { type TCustomCssChangeKind } from "./draft";
import { type TCustomCssValidationStatus } from "./validation";

/**
 * What the creator may do with the CSS fields (ENG-2949, M4.4):
 * - `full`: type, upload, clear and save.
 * - `read-only`: the role cannot change this CSS at all.
 */
export type TCustomCssEditMode = "full" | "read-only";

export const getCustomCssEditMode = (params: { canEdit: boolean }): TCustomCssEditMode =>
  params.canEdit ? "full" : "read-only";

/**
 * What the Appearance page's single Save does with the workspace CSS draft (ENG-3723):
 * - `skip`: nothing to save: an unchanged draft or a read-only role. The theme still saves.
 * - `block`: the draft is known to be invalid, so the whole Save stops and the theme waits with it.
 * - `submit`: everything else, including a draft whose check is still running; the server checks it
 *   again either way, as the survey editor's manual save does.
 */
export type TWorkspaceCssSaveStep = "skip" | "block" | "submit";

export const getWorkspaceCssSaveStep = (params: {
  mode: TCustomCssEditMode;
  changeKind: TCustomCssChangeKind;
  status: TCustomCssValidationStatus;
}): TWorkspaceCssSaveStep => {
  if (params.mode === "read-only" || params.changeKind === "unchanged") return "skip";
  return params.status === "invalid" ? "block" : "submit";
};
