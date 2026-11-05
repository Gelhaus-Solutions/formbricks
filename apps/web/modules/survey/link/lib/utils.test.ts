import { describe, expect, test } from "vitest";
import { TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  getElementsFromSurveyBlocks,
  getGateLocale,
  getSurveyLanguageTag,
  getWebAppLocale,
  isRTL,
  isRTLLanguage,
  resolveLinkSurveyLanguage,
  resolveWebAppLocale,
} from "./utils";

const createMockSurvey = (languages: TSurvey["languages"] = []): TSurvey =>
  ({
    id: "survey-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Test",
    type: "link",
    workspaceId: "ws-1",
    createdBy: null,
    status: "draft",
    visibility: "workspace",
    ownerId: null,
    visibilityVersion: 0,
    visibilityProjectedVersion: 0,
    visibilityChangedAt: null,
    visibilityChangedById: null,
    displayOption: "displayOnce",
    autoClose: null,
    publishOn: null,
    closeOn: null,
    isAutoProgressingEnabled: false,
    triggers: [],
    recontactDays: null,
    displayLimit: null,
    welcomeCard: {
      enabled: false,
      headline: { default: "Welcome" },
      timeToFinish: false,
      showResponseCount: false,
    },
    questions: [],
    blocks: [],
    endings: [],
    hiddenFields: { enabled: false, fieldIds: [] },
    variables: [],
    styling: null,
    segment: null,
    languages,
    displayPercentage: null,
    isVerifyEmailEnabled: false,
    singleUse: null,
    pin: null,
    workspaceOverwrites: null,
    surveyClosedMessage: null,
    followUps: [],
    delay: 0,
    autoComplete: null,
    showLanguageSwitch: null,
    recaptcha: null,
    isBackButtonHidden: false,
    isCaptureIpEnabled: false,
    isAnonymizeResponsesEnabled: false,
    slug: null,
    metadata: {},
  }) as TSurvey;

describe("getWebAppLocale", () => {
  test("maps language codes and handles defaults, reading English for every language the app does not ship", () => {
    expect(getWebAppLocale("en", createMockSurvey())).toBe("en-US");
    expect(getWebAppLocale("de", createMockSurvey())).toBe("en-US");
    const surveyWithLang = createMockSurvey([
      {
        language: {
          id: "l1",
          code: "de",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: "p1",
        },
        default: true,
        enabled: true,
      },
    ]);
    expect(getWebAppLocale("default", surveyWithLang)).toBe("en-US");
    expect(getWebAppLocale("xx", createMockSurvey())).toBe("en-US");
  });

  test("returns en-US when default requested but no default language", () => {
    const surveyNoDefault = createMockSurvey([
      {
        language: {
          id: "l1",
          code: "de",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: "p1",
        },
        default: false,
        enabled: true,
      },
    ]);
    expect(getWebAppLocale("default", surveyNoDefault)).toBe("en-US");
  });

  test("matches base language code for variants", () => {
    expect(getWebAppLocale("en-GB", createMockSurvey())).toBe("en-US");
    expect(getWebAppLocale("pt-PT", createMockSurvey())).toBe("en-US");
  });
});

const createLanguage = (code: string, isDefault = false, enabled = true) => ({
  language: {
    id: `l-${code}`,
    code,
    alias: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: "p1",
  },
  default: isDefault,
  enabled,
});

describe("resolveWebAppLocale", () => {
  test("returns null instead of English when the app has no translation for the language", () => {
    // A Hebrew survey must not drag the chrome to English: the caller keeps its own fallback.
    expect(resolveWebAppLocale("he", createMockSurvey())).toBeNull();
    expect(resolveWebAppLocale("xx", createMockSurvey())).toBeNull();
    expect(resolveWebAppLocale("default", createMockSurvey())).toBeNull();
  });

  test("resolves no language the app no longer ships", () => {
    expect(resolveWebAppLocale("de", createMockSurvey())).toBeNull();
    expect(resolveWebAppLocale("pt-PT", createMockSurvey())).toBeNull();
    expect(resolveWebAppLocale("zh-Hant-HK", createMockSurvey())).toBeNull();
  });

  test("matches English and its regional variants, regardless of case", () => {
    expect(resolveWebAppLocale("en", createMockSurvey())).toBe("en-US");
    expect(resolveWebAppLocale("en-GB", createMockSurvey())).toBe("en-US");
    expect(resolveWebAppLocale("EN-us", createMockSurvey())).toBe("en-US");
  });

  test("resolves 'default' through the survey's default language", () => {
    expect(resolveWebAppLocale("default", createMockSurvey([createLanguage("en-GB", true)]))).toBe("en-US");
    expect(resolveWebAppLocale("default", createMockSurvey([createLanguage("de", true)]))).toBeNull();
  });
});

describe("resolveLinkSurveyLanguage", () => {
  const languages = [createLanguage("en-US", true), createLanguage("de-DE")];
  const optedIn = { ...createMockSurvey(languages), autoSelectLanguage: true };

  test("prefers an explicit ?lang= over the browser languages", () => {
    expect(
      resolveLinkSurveyLanguage({ survey: optedIn, lang: "en-US", acceptedLanguages: ["de-DE"] })
    ).toEqual({ langParam: "en-US", languageCode: "default" });
  });

  test("falls through an unmatched ?lang= to the browser languages", () => {
    expect(resolveLinkSurveyLanguage({ survey: optedIn, lang: "xx", acceptedLanguages: ["de-DE"] })).toEqual({
      langParam: "xx",
      languageCode: "de-DE",
    });
  });

  test("ignores the browser languages when the survey did not opt in", () => {
    const survey = { ...createMockSurvey(languages), autoSelectLanguage: false };
    expect(resolveLinkSurveyLanguage({ survey, lang: undefined, acceptedLanguages: ["de-DE"] })).toEqual({
      langParam: undefined,
      languageCode: "default",
    });
  });

  test("treats a repeated ?lang= as no explicit language", () => {
    expect(
      resolveLinkSurveyLanguage({ survey: optedIn, lang: ["en-US", "de-DE"], acceptedLanguages: ["de-DE"] })
    ).toEqual({ langParam: undefined, languageCode: "de-DE" });
  });
});

describe("getGateLocale", () => {
  const survey = createMockSurvey([createLanguage("en", true), createLanguage("de")]);

  // The app ships English only, so the fallback below is always en-US in practice; "fr-FR" stands in for
  // it here to show which branch answered.
  test("uses the requested language when the app ships it, so the gate matches the survey behind it", () => {
    expect(getGateLocale({ langParam: "en-GB", languageCode: "en", survey, fallbackLocale: "fr-FR" })).toBe(
      "en-US"
    );
  });

  test("keeps the Accept-Language locale when the link requests no language", () => {
    expect(
      getGateLocale({ langParam: undefined, languageCode: "default", survey, fallbackLocale: "fr-FR" })
    ).toBe("fr-FR");
    // An empty `?lang=` is no request either.
    expect(getGateLocale({ langParam: "", languageCode: "default", survey, fallbackLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
  });

  test("follows a language picked from the browser languages, with no `?lang=`", () => {
    const germanFirst = createMockSurvey([createLanguage("de", true), createLanguage("en")]);
    expect(
      getGateLocale({
        langParam: undefined,
        languageCode: "en",
        survey: germanFirst,
        fallbackLocale: "fr-FR",
      })
    ).toBe("en-US");
  });

  test("keeps the Accept-Language locale when the requested language is not one the app speaks", () => {
    // `?lang=` was given but resolves to a language with no app translation (Hebrew here): the
    // respondent's own browser locale is a better guess than forcing English on them.
    expect(getGateLocale({ langParam: "he", languageCode: "he", survey, fallbackLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
    // German too: GForms ships the app's own strings in English only.
    expect(getGateLocale({ langParam: "de", languageCode: "de", survey, fallbackLocale: "fr-FR" })).toBe(
      "fr-FR"
    );
  });

  test("follows the survey default for a language the survey has not enabled", () => {
    // getLanguageCode resolves an unknown or disabled `?lang=` to "default", and the content will
    // render in the survey's default language, so the gate reads that language, not the browser's.
    expect(
      getGateLocale({ langParam: "it-IT", languageCode: "default", survey, fallbackLocale: "fr-FR" })
    ).toBe("en-US");
  });
});

describe("isRTL", () => {
  test("detects RTL characters", () => {
    expect(isRTL("مرحبا")).toBe(true);
    expect(isRTL("שלום")).toBe(true);
    expect(isRTL("Hello")).toBe(false);
  });
});

describe("isRTLLanguage", () => {
  const createJsSurvey = (
    languages: TJsWorkspaceStateSurvey["languages"] = [],
    blocks: TSurveyBlock[] = []
  ): TJsWorkspaceStateSurvey =>
    ({
      id: "s1",
      createdAt: new Date(),
      updatedAt: new Date(),
      name: "Test",
      type: "link",
      workspaceId: "ws-1",
      welcomeCard: {
        enabled: false,
        headline: { default: "Welcome" },
        timeToFinish: false,
        showResponseCount: false,
      },
      blocks,
      languages,
    }) as unknown as TJsWorkspaceStateSurvey;

  test("checks language codes when multi-language enabled", () => {
    const survey = createJsSurvey([
      {
        language: {
          id: "l1",
          code: "ar",
          alias: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          workspaceId: "p1",
        },
        default: true,
        enabled: true,
      },
    ]);
    expect(isRTLLanguage(survey, "ar")).toBe(true);
    expect(isRTLLanguage(survey, "en")).toBe(false);
  });

  test("checks content when no languages configured", () => {
    const element = {
      id: "q1",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "مرحبا" },
      required: false,
    } as unknown as TSurveyElement;
    const block = { id: "b1", name: "Block", elements: [element] } as TSurveyBlock;
    expect(isRTLLanguage(createJsSurvey([], [block]), "default")).toBe(true);
  });

  test("checks welcomeCard headline when enabled and no languages", () => {
    const survey = {
      ...createJsSurvey([], []),
      welcomeCard: { enabled: true, headline: { default: "مرحبا" } },
    } as unknown as TJsWorkspaceStateSurvey;
    expect(isRTLLanguage(survey, "default")).toBe(true);
  });

  test("returns false when no languages and no headlines found", () => {
    const element = { id: "q1", type: TSurveyElementTypeEnum.OpenText, headline: {}, required: false };
    const block = { id: "b1", name: "Block", elements: [element] } as TSurveyBlock;
    expect(isRTLLanguage(createJsSurvey([], [block]), "default")).toBe(false);
  });
});

describe("getSurveyLanguageTag", () => {
  const langSurvey = (languages: TJsWorkspaceStateSurvey["languages"] = []): TJsWorkspaceStateSurvey =>
    ({ languages }) as unknown as TJsWorkspaceStateSurvey;

  const enAU = {
    language: {
      id: "l1",
      code: "en-AU",
      alias: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      workspaceId: "p1",
    },
    default: true,
    enabled: true,
  };

  test("returns an explicit (non-default) code as-is", () => {
    expect(getSurveyLanguageTag(langSurvey([enAU]), "he")).toBe("he");
  });

  test("resolves 'default' to the survey's default language code", () => {
    expect(getSurveyLanguageTag(langSurvey([enAU]), "default")).toBe("en-AU");
  });

  test("returns null when 'default' but no language is configured", () => {
    expect(getSurveyLanguageTag(langSurvey([]), "default")).toBeNull();
  });
});

describe("getElementsFromSurveyBlocks", () => {
  test("extracts elements from blocks", () => {
    const el1 = {
      id: "q1",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Q1" },
      required: false,
    } as unknown as TSurveyElement;
    const el2 = {
      id: "q2",
      type: TSurveyElementTypeEnum.OpenText,
      headline: { default: "Q2" },
      required: false,
    } as unknown as TSurveyElement;
    const block = { id: "b1", name: "Block", elements: [el1, el2] } as TSurveyBlock;
    const result = getElementsFromSurveyBlocks([block]);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("q1");
  });
});
