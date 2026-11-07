import { describe, expect, test } from "vitest";
import {
  getReservedFutureDefaultAttributeKeyIssue,
  isReservedFutureDefaultAttributeKey,
} from "./attribute-key-policy";

describe("attribute key policy", () => {
  test("reserves the safe-identifier names of the camelCase default keys", () => {
    expect(isReservedFutureDefaultAttributeKey("user_id")).toBe(true);
    expect(isReservedFutureDefaultAttributeKey("first_name")).toBe(true);
    expect(isReservedFutureDefaultAttributeKey("last_name")).toBe(true);
  });

  test("leaves the current defaults and custom keys free", () => {
    expect(isReservedFutureDefaultAttributeKey("userId")).toBe(false);
    expect(isReservedFutureDefaultAttributeKey("email")).toBe(false);
    expect(isReservedFutureDefaultAttributeKey("plan")).toBe(false);
  });

  test("names every reserved key in the issue", () => {
    expect(getReservedFutureDefaultAttributeKeyIssue(["user_id", "last_name"])).toBe(
      "Reserved attribute key(s): user_id, last_name. These keys are reserved for the v5.1 safe-identifier default attribute migration and cannot be created as custom attributes."
    );
  });
});
