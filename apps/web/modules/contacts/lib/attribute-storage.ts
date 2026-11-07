import type { TContactAttributeDataType } from "@formbricks/types/contact-attribute-key";

type TStoredAttributeValue = {
  value: string;
  valueNumber: number | null;
  valueDate: Date | null;
};

/**
 * An attribute value as text, read from the column its key's data type fills: a number as its decimal
 * string, a date as ISO 8601. When that column is empty (a value that did not parse on write), the
 * stored text is returned as written.
 */
export const readAttributeValue = (
  attribute: TStoredAttributeValue,
  dataType: TContactAttributeDataType
): string => {
  if (dataType === "number" && attribute.valueNumber !== null) {
    return String(attribute.valueNumber);
  }
  if (dataType === "date" && attribute.valueDate !== null) {
    return attribute.valueDate.toISOString();
  }
  return attribute.value;
};
