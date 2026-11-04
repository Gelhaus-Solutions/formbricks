import {
  type JobHandler,
  type JobHandlerOverrides,
  ONE_SHOT_JOB_NAMES,
  type RecurringJobHandle,
  type TAttachmentExportJobData,
  type TGlobalScopeJobData,
  type TRecurringBackgroundJobSchedule,
  type TRecurringJobKey,
  type TResponsePipelineJobData,
  type TWebhookDeliveryJobData,
  recurringJobs,
} from "@formbricks/jobs";
import { processAuthzedProjectionDeliveryJob } from "@/lib/authzed/outbox-processor";
import {
  processAuthzedScheduledReconciliationJob,
  processAuthzedSurveyAuditJob,
} from "@/lib/authzed/scheduled-reconciliation";
import { DELETION_CLEANUP_DRAIN_INTERVAL_MS } from "@/modules/deletion-cleanup/lib/constants";
import { processDeletionCleanupDrainJob } from "@/modules/deletion-cleanup/lib/process-deletion-cleanup-drain-job";
import {
  CREATIVE_STATS_FLUSH_INTERVAL_MS,
  processCreativeStatsFlushJob,
} from "@/modules/ee/creatives/lib/process-creative-stats-flush-job";
import {
  DATA_RETENTION_SWEEP_DAILY_CRON_PATTERN,
  DATA_RETENTION_SWEEP_TIME_ZONE,
} from "@/modules/ee/data-retention/sweep/constants";
import { processDataRetentionSweepJob } from "@/modules/ee/data-retention/sweep/process-data-retention-sweep-job";
import { processEmailAuditMaintenanceJob } from "@/modules/email/lib/email-audit-maintenance";
import { processResponsePipelineJob } from "@/modules/response-pipeline/lib/process-response-pipeline-job";
import { processWebhookDeliveryJob } from "@/modules/response-pipeline/lib/process-webhook-delivery-job";
import { processAttachmentExportJob } from "@/modules/storage/attachment-export/process-attachment-export-job";
import { processAttachmentExportReconcileJob } from "@/modules/storage/attachment-export/process-attachment-export-reconcile-job";
import {
  SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
  SURVEY_ARCHIVE_PURGE_TIME_ZONE,
} from "@/modules/survey/archive/lib/constants";
import { processSurveyArchivePurgeJob } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import {
  SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
  SURVEY_SCHEDULING_TIME_ZONE,
} from "@/modules/survey/scheduling/lib/constants";
import { processSurveySchedulingJob } from "@/modules/survey/scheduling/lib/process-survey-scheduling-job";

/**
 * Adapts an app handler to the worker's override signature. The worker validates the payload against
 * the job's schema before dispatching, so this is the single place where that already-checked value is
 * narrowed — rather than one unchecked cast per job.
 */
const toJobHandlerOverride =
  <TData>(handler: JobHandler<TData>): NonNullable<JobHandlerOverrides[string]> =>
  async (data, context) => {
    await handler(data as TData, context);
  };

interface RecurringJobRegistration {
  handler: JobHandler<TGlobalScopeJobData>;
  job: RecurringJobHandle;
  schedule: TRecurringBackgroundJobSchedule;
  requiresReleaseActivation?: boolean;
}

/**
 * The app's half of each recurring job: when it runs (env-derived timing) and what runs. The job name,
 * schedule identity and payload live with the declaration in `@formbricks/jobs`, so neither the name nor
 * the identity is ever spelled out here — which is what keeps the schedule and its handler in step.
 *
 * Keyed by `TRecurringJobKey` deliberately: declaring a new job in `recurringJobDescriptors` without
 * adding it here is then a build error rather than a job that quietly never runs — its schedule would
 * never be upserted and its handler never registered.
 *
 * The key only forces an entry to *exist*; pairing a key with another job's handle still type-checks,
 * and would be worse than a swap (both entries upsert the same scheduler, so one job's schedule is never
 * registered at all). A test pins the pairing instead.
 */
export const RECURRING_JOB_REGISTRATIONS_BY_KEY: Record<TRecurringJobKey, RecurringJobRegistration> = {
  attachmentExportReconcile: {
    requiresReleaseActivation: true,
    handler: processAttachmentExportReconcileJob,
    job: recurringJobs.attachmentExportReconcile,
    schedule: { everyMs: 5 * 60_000, kind: "every" },
  },
  emailAuditMaintenance: {
    requiresReleaseActivation: true,
    handler: processEmailAuditMaintenanceJob,
    job: recurringJobs.emailAuditMaintenance,
    schedule: { everyMs: 5 * 60_000, kind: "every" },
  },
  authzedProjectionDelivery: {
    handler: processAuthzedProjectionDeliveryJob,
    job: recurringJobs.authzedProjectionDelivery,
    schedule: {
      everyMs: 5_000,
      kind: "every",
    },
  },
  authzedReconciliationAudit: {
    handler: processAuthzedScheduledReconciliationJob,
    job: recurringJobs.authzedReconciliationAudit,
    schedule: {
      everyMs: 6 * 60 * 60 * 1_000,
      kind: "every",
    },
  },
  // ENG-3282: daily rather than six-hourly — its cost grows with the number of surveys, not grants.
  authzedSurveyAudit: {
    requiresReleaseActivation: true,
    handler: processAuthzedSurveyAuditJob,
    job: recurringJobs.authzedSurveyAudit,
    schedule: {
      everyMs: 24 * 60 * 60 * 1_000,
      kind: "every",
    },
  },
  // ENG-4000: new in this release, so scheduled only once the release is activated (older replicas
  // have no handler). Idempotent, so an overlapping or retried run is harmless.
  creativeStatsFlush: {
    requiresReleaseActivation: true,
    handler: processCreativeStatsFlushJob,
    job: recurringJobs.creativeStatsFlush,
    schedule: {
      everyMs: CREATIVE_STATS_FLUSH_INTERVAL_MS,
      kind: "every",
    },
  },
  // New in this release, like the cleanup drain below: during an online upgrade, scheduled only once
  // the release is activated (older replicas have no handler for either, and the sweep acts on data).
  dataRetentionSweep: {
    requiresReleaseActivation: true,
    handler: processDataRetentionSweepJob,
    job: recurringJobs.dataRetentionSweep,
    schedule: {
      cronPattern: DATA_RETENTION_SWEEP_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: DATA_RETENTION_SWEEP_TIME_ZONE,
    },
  },
  deletionCleanupDrain: {
    requiresReleaseActivation: true,
    handler: processDeletionCleanupDrainJob,
    job: recurringJobs.deletionCleanupDrain,
    schedule: {
      everyMs: DELETION_CLEANUP_DRAIN_INTERVAL_MS,
      kind: "every",
    },
  },
  surveyArchivePurge: {
    handler: processSurveyArchivePurgeJob,
    job: recurringJobs.surveyArchivePurge,
    schedule: {
      cronPattern: SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_ARCHIVE_PURGE_TIME_ZONE,
    },
  },
  surveyScheduling: {
    handler: processSurveySchedulingJob,
    job: recurringJobs.surveyScheduling,
    schedule: {
      cronPattern: SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_SCHEDULING_TIME_ZONE,
    },
  },
};

export const RECURRING_JOB_REGISTRATIONS: readonly RecurringJobRegistration[] = Object.values(
  RECURRING_JOB_REGISTRATIONS_BY_KEY
);

/** Handler overrides for every job whose real implementation lives in this app. */
export const getJobHandlerOverrides = (): JobHandlerOverrides => ({
  [ONE_SHOT_JOB_NAMES.attachmentExport]:
    toJobHandlerOverride<TAttachmentExportJobData>(processAttachmentExportJob),
  [ONE_SHOT_JOB_NAMES.responsePipeline]:
    toJobHandlerOverride<TResponsePipelineJobData>(processResponsePipelineJob),
  [ONE_SHOT_JOB_NAMES.webhookDelivery]:
    toJobHandlerOverride<TWebhookDeliveryJobData>(processWebhookDeliveryJob),
  ...Object.fromEntries(
    RECURRING_JOB_REGISTRATIONS.map((registration) => [
      registration.job.name,
      toJobHandlerOverride(registration.handler),
    ])
  ),
});
