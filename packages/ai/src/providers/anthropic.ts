import { createAnthropic } from "@ai-sdk/anthropic";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";
import { AIConfigurationError } from "../errors";
import { modelFetch } from "../model-fetch";
import type { AIProviderAdapter } from "../registry";
import { getCredentialFingerprint, normalizeValue } from "../shared";
import type { AIEnvironment } from "../types";

// Pinned rather than left to the SDK, which would otherwise read ANTHROPIC_BASE_URL from the process
// environment and send the API key wherever that points. Every setting of this provider is an AI_* one.
const ANTHROPIC_API_BASE_URL = "https://api.anthropic.com/v1";

/**
 * Corrects two request defaults of @ai-sdk/anthropic 3.0.76 that break current Claude models. Its
 * capability table ends with the Claude 4 generation, so it treats every newer model id as unknown:
 *
 * - Structured output: for an unknown model it falls back to a `json` tool with a forced tool choice,
 *   which Claude Opus 5.5, Sonnet 5.5 and Fable 5.1 reject with a 400. The native `output_config.format`
 *   is used instead, for every model. That is why the docs ask for Claude 4.5 or newer: Claude Sonnet 4
 *   and Opus 4 predate it.
 * - Sampling: survey generation and the Qualtrics import send `temperature`, which Claude Opus 4.7 and
 *   later reject. The SDK strips it only for the one model id it knows, so it is dropped here for every
 *   model; a schema-bound answer does not depend on it.
 */
const claudeRequestDefaults: LanguageModelMiddleware = {
  specificationVersion: "v3",
  transformParams: ({ params }) =>
    Promise.resolve({
      ...params,
      temperature: undefined,
      topP: undefined,
      topK: undefined,
      providerOptions: {
        ...params.providerOptions,
        anthropic: { ...params.providerOptions?.anthropic, structuredOutputMode: "outputFormat" },
      },
    }),
};

export const anthropicProviderAdapter: AIProviderAdapter = {
  validate: (environment: AIEnvironment) => ({
    missingFields: normalizeValue(environment.AI_ANTHROPIC_API_KEY) ? [] : ["AI_ANTHROPIC_API_KEY"],
    invalidFields: [],
  }),
  buildCacheKey: (model: string, environment: AIEnvironment) =>
    JSON.stringify({
      provider: "anthropic",
      model,
      apiKey: getCredentialFingerprint(environment.AI_ANTHROPIC_API_KEY),
    }),
  createModel: (model: string, environment: AIEnvironment) => {
    const apiKey = normalizeValue(environment.AI_ANTHROPIC_API_KEY);

    if (!apiKey) {
      throw new AIConfigurationError("providerNotConfigured", "Anthropic API key is missing", {
        provider: "anthropic",
        missingFields: ["AI_ANTHROPIC_API_KEY"],
      });
    }

    const anthropic = createAnthropic({ fetch: modelFetch, apiKey, baseURL: ANTHROPIC_API_BASE_URL });

    return wrapLanguageModel({ model: anthropic(model), middleware: claudeRequestDefaults });
  },
};
