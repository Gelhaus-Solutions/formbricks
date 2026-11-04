// @vitest-environment happy-dom
import { beforeEach, describe, expect, test } from "vitest";
import { FOCUS_KEY_ATTRIBUTE, getFocusChoiceForKey, markFocusChoices } from "./focus-layout";

const listChoice = (type: "radio" | "checkbox", label: string) => `
  <label data-fb-part="option">
    <span><input type="${type}" /><span data-fb-part="option-control"></span><span data-fb-part="option-label">${label}</span></span>
  </label>`;

const render = (html: string): HTMLElement => {
  document.body.innerHTML = `<div id="content">${html}</div>`;
  return document.getElementById("content")!;
};

const letters = (content: Element) =>
  Array.from(content.querySelectorAll('[data-fb-part="option"]')).map((option) =>
    option.getAttribute(FOCUS_KEY_ATTRIBUTE)
  );

describe("Focus choice letters", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("letters single- and multi-select rows per group, on the row and on its control", () => {
    const content = render(`
      <fieldset>
        <fieldset>${listChoice("radio", "One")}${listChoice("radio", "Two")}</fieldset>
        <fieldset>${listChoice("checkbox", "Red")}${listChoice("checkbox", "Blue")}${listChoice("checkbox", "Green")}</fieldset>
      </fieldset>`);

    markFocusChoices(content);

    expect(letters(content)).toEqual(["A", "B", "A", "B", "C"]);
    const controls = Array.from(content.querySelectorAll('[data-fb-part="option-control"]'));
    expect(controls.map((control) => control.getAttribute(FOCUS_KEY_ATTRIBUTE))).toEqual([
      "A",
      "B",
      "A",
      "B",
      "C",
    ]);
  });

  test("leaves rating steps, ranking items and matrix cells unlettered", () => {
    const content = render(`
      <fieldset><label data-fb-part="option"><input type="radio" /><span>5</span></label></fieldset>
      <fieldset><div data-fb-part="option"><span data-fb-part="option-control">1</span>Item</div></fieldset>
      <fieldset><table><tr><td><label data-fb-part="option"><input type="radio" /><span data-fb-part="option-control"></span></label></td></tr></table></fieldset>`);

    markFocusChoices(content);

    expect(letters(content)).toEqual([null, null, null]);
  });

  test("clears a letter left on a node that is no longer a list choice", () => {
    const content = render(`<fieldset>${listChoice("radio", "One")}</fieldset>`);
    markFocusChoices(content);
    content.querySelector("input")!.remove();

    markFocusChoices(content);

    expect(content.querySelectorAll(`[${FOCUS_KEY_ATTRIBUTE}]`)).toHaveLength(0);
  });

  test("finds a choice by letter in the focused group, else in the first group", () => {
    const content = render(`
      <fieldset id="first">${listChoice("radio", "One")}${listChoice("radio", "Two")}</fieldset>
      <fieldset id="second">${listChoice("checkbox", "Red")}${listChoice("checkbox", "Blue")}</fieldset>`);
    markFocusChoices(content);
    const insideSecond = content.querySelector("#second input")!;

    expect(getFocusChoiceForKey(content, "b", null)?.textContent).toContain("Two");
    expect(getFocusChoiceForKey(content, "B", insideSecond)?.textContent).toContain("Blue");
    expect(getFocusChoiceForKey(content, "c", null)).toBeNull();
    expect(getFocusChoiceForKey(content, "Enter", null)).toBeNull();
    expect(getFocusChoiceForKey(content, "1", null)).toBeNull();
  });
});
