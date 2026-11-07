import { describe, expect, test } from "vitest";
import { getCustomCssEditMode, getWorkspaceCssSaveStep } from "./edit-mode";

describe("getCustomCssEditMode", () => {
  test("the role decides", () => {
    expect(getCustomCssEditMode({ canEdit: false })).toBe("read-only");
    expect(getCustomCssEditMode({ canEdit: true })).toBe("full");
  });
});

describe("getWorkspaceCssSaveStep", () => {
  test("submits an edit with full access, including one whose check is still running", () => {
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "valid" })).toBe("submit");
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "pending" })).toBe("submit");
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "unavailable" })).toBe(
      "submit"
    );
  });

  test("stops the page's Save for a draft known to be invalid", () => {
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "edit", status: "invalid" })).toBe("block");
  });

  test("skips an unchanged draft and a read-only role, so the theme saves alone", () => {
    expect(getWorkspaceCssSaveStep({ mode: "full", changeKind: "unchanged", status: "invalid" })).toBe(
      "skip"
    );
    expect(getWorkspaceCssSaveStep({ mode: "read-only", changeKind: "removal", status: "empty" })).toBe(
      "skip"
    );
  });
});
