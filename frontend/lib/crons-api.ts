import { apiFetch } from "./api";

export interface CronJob {
  id: string;
  name: string;
  trigger: string;
  trigger_type: "interval" | "cron" | "other";
  interval_minutes: number | null;
  cron_hour: number | string | null;
  cron_minute: number | string | null;
  cron_day_of_week: string | null;
  next_run_time: string | null;
  status: "running" | "paused" | "unknown";
}

export interface CronTemplate {
  id: string;
  description: string;
  trigger_type: "interval" | "cron" | "other";
  interval_minutes: number | null;
  cron_hour: number | null;
  cron_minute: number | null;
  cron_day_of_week: string | null;
  already_registered: boolean;
}

export interface RescheduleRequest {
  interval_minutes?: number;
  cron_hour?: number;
  cron_minute?: number;
  cron_day_of_week?: string;
}

export interface AddJobRequest {
  job_id: string;
  interval_minutes?: number;
  cron_hour?: number;
  cron_minute?: number;
  cron_day_of_week?: string;
}

export const cronsApi = {
  getJobs: (): Promise<CronJob[]> => apiFetch("/api/v1/crons/jobs"),

  getTemplates: (): Promise<CronTemplate[]> =>
    apiFetch("/api/v1/crons/templates"),

  reschedule: (id: string, body: RescheduleRequest): Promise<CronJob> =>
    apiFetch(`/api/v1/crons/jobs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  remove: (id: string): Promise<void> =>
    apiFetch(`/api/v1/crons/jobs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  add: (body: AddJobRequest): Promise<CronJob> =>
    apiFetch(`/api/v1/crons/jobs`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  pause: (id: string): Promise<CronJob> =>
    apiFetch(`/api/v1/crons/jobs/${encodeURIComponent(id)}/pause`, {
      method: "POST",
    }),

  resume: (id: string): Promise<CronJob> =>
    apiFetch(`/api/v1/crons/jobs/${encodeURIComponent(id)}/resume`, {
      method: "POST",
    }),

  runNow: (id: string): Promise<CronJob> =>
    apiFetch(`/api/v1/crons/jobs/${encodeURIComponent(id)}/run-now`, {
      method: "POST",
    }),
};
