import type {
  TFeedbackSourceFieldMappingCreateInput,
  THubTargetField,
} from "@formbricks/types/feedback-source";

/**
 * Limits, error codes and fixed mappings of the CSV feedback source import (GFORMS-3), shared by the
 * import in this folder and the internal CSV import route. Written from those call sites, their specs
 * and the public documentation of CSV feedback sources.
 */

export const MAX_CSV_VALUES = {
  /** Largest CSV file the import reads, in bytes. */
  FILE_SIZE: 15 * 1024 * 1024,
  /** Most data rows one import reads. */
  RECORDS: 1000,
} as const;

// Codes the import route returns in `error` and the import throws in `CsvImportValidationError.code`.
export const CSV_AT_LEAST_ONE_ROW_ERROR_CODE = "CSV_AT_LEAST_ONE_ROW";
export const CSV_EMPTY_COLUMN_HEADERS_ERROR_CODE = "CSV_EMPTY_COLUMN_HEADERS";
export const CSV_FILES_ONLY_ERROR_CODE = "CSV_FILES_ONLY";
export const CSV_FILE_TOO_LARGE_ERROR_CODE = "CSV_FILE_TOO_LARGE";
export const CSV_INCONSISTENT_COLUMNS_ERROR_CODE = "CSV_INCONSISTENT_COLUMNS";
export const CSV_MAX_RECORDS_ERROR_CODE = "CSV_MAX_RECORDS";
export const CSV_PARSE_ERROR_CODE = "CSV_PARSE_ERROR";
export const CSV_IMPORT_FAILED_ERROR_CODE = "CSV_IMPORT_FAILED";
/** A file that lacks a column the source's saved mapping reads. */
export const CSV_IMPORT_MISSING_COLUMNS_ERROR_CODE = "CSV_IMPORT_MISSING_COLUMNS";

/** Hub fields a CSV mapping may not set: the tenant is the source's directory, the source type is fixed. */
export const CSV_PROTECTED_TARGET_IDS: readonly THubTargetField[] = ["tenant_id", "source_type"];

/** Mappings every CSV source gets, whatever the user mapped. */
export const CSV_HIDDEN_STATIC_MAPPINGS: readonly TFeedbackSourceFieldMappingCreateInput[] = [
  { sourceFieldId: "", targetFieldId: "source_type", staticValue: "csv" },
];

/** Hub fields a CSV mapping must fill, from a column or a fixed value. `response_value` is the answer. */
export const CSV_REQUIRED_UI_FIELDS: readonly THubTargetField[] = [
  "submission_id",
  "field_id",
  "field_type",
  "response_value",
];
