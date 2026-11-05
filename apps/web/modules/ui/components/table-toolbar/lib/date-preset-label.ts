import type { TFunction } from "i18next";
import type { TDateRangePreset } from "@/lib/date-ranges";

// Spelled out per preset, not built from the preset's name: the translation scan only sees literal keys.
const PRESET_LABELS: Record<TDateRangePreset, (t: TFunction) => string> = {
  today: (t) => t("workspace.analysis.charts.date_preset_today"),
  yesterday: (t) => t("workspace.analysis.charts.date_preset_yesterday"),
  "last 24 hours": (t) => t("workspace.analysis.charts.date_preset_last_24_hours"),
  "last 7 days": (t) => t("workspace.analysis.charts.date_preset_last_7_days"),
  "last 30 days": (t) => t("workspace.analysis.charts.date_preset_last_30_days"),
  "last 90 days": (t) => t("workspace.analysis.charts.date_preset_last_90_days"),
  "this month": (t) => t("workspace.analysis.charts.date_preset_this_month"),
  "last month": (t) => t("workspace.analysis.charts.date_preset_last_month"),
  "this quarter": (t) => t("workspace.analysis.charts.date_preset_this_quarter"),
  "last quarter": (t) => t("workspace.analysis.charts.date_preset_last_quarter"),
  "last 6 months": (t) => t("workspace.analysis.charts.date_preset_last_6_months"),
  "this year": (t) => t("workspace.analysis.charts.date_preset_this_year"),
  "last year": (t) => t("workspace.analysis.charts.date_preset_last_year"),
};

/** The name a date filter shows for a relative date range, in the viewer's language. */
export const getDatePresetLabel = (preset: TDateRangePreset, t: TFunction): string =>
  PRESET_LABELS[preset](t);
