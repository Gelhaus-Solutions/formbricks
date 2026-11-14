/**
 * Attribute keys a custom attribute may not take. The default attribute keys are still camelCase
 * (`userId`, `firstName`, `lastName`) until the upstream v5.1 migration moves them to safe identifiers;
 * the keys it moves them to are kept free for it.
 */
export const RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEYS: readonly string[] = [
  "user_id",
  "first_name",
  "last_name",
];

/** The validation message for a reserved key. */
export const RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEY_VALIDATION_MESSAGE = `Key is reserved for the v5.1 safe-identifier default attribute migration. Reserved keys: ${RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEYS.join(", ")}.`;

export const isReservedFutureDefaultAttributeKey = (key: string): boolean =>
  RESERVED_FUTURE_DEFAULT_ATTRIBUTE_KEYS.includes(key);

/** The validation issue for one or more reserved keys. */
export const getReservedFutureDefaultAttributeKeyIssue = (keys: readonly string[]): string =>
  `Reserved attribute key(s): ${keys.join(", ")}. These keys are reserved for the v5.1 safe-identifier default attribute migration and cannot be created as custom attributes.`;
