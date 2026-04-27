"use client";

/**
 * /crons — Scheduled Job Inspector + Manager (Sovereign Terminal design)
 *
 * Lists registered APScheduler jobs and lets the user:
 *   • Edit   — reschedule interval or cron fields
 *   • Delete — remove from the scheduler (can be re-added)
 *   • Add    — re-add a job from the template registry
 *   • Pause / Resume — toggle without removing
 *   • Run now — trigger one immediate execution
 *
 * All mutations are in-memory on the backend and lost on process restart;
 * `register_jobs()` restores every template job to its default cadence on
 * startup. Communicate that caveat via the footer copy.
 */

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  RefreshCw,
  Activity,
  Loader2,
  AlertTriangle,
  Timer,
  Pencil,
  Trash2,
  Plus,
  Play,
  Pause,
  Zap,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, useAuth } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cronsApi } from "@/lib/crons-api";
import type { CronJob, CronTemplate } from "@/lib/crons-api";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNextRun(iso: string | null): string {
  if (!iso) return "Paused";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function humaniseName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CronJob["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-bold border bg-green-500/15 text-green-400 border-green-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
        RUNNING
      </span>
    );
  }
  if (status === "paused") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-bold border bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
        PAUSED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-2xs font-bold border bg-surface-highest text-muted-foreground border-border">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      UNKNOWN
    </span>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowActions({
  job,
  onEdit,
  onPauseToggle,
  onRunNow,
  onDelete,
  disabled,
}: {
  job: CronJob;
  onEdit: () => void;
  onPauseToggle: () => void;
  onRunNow: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const paused = job.status === "paused";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Job actions"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="h-7 w-7 inline-flex items-center justify-center rounded-sm border border-border/50 hover:border-primary/40 hover:bg-surface-high transition-colors disabled:opacity-40"
      >
        {disabled ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-44 bg-surface-high border border-border shadow-lg overflow-hidden">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 flex items-center gap-2"
            onMouseDown={onRunNow}
          >
            <Zap className="h-3.5 w-3.5 text-yellow-400" />
            Run Now
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 flex items-center gap-2"
            onMouseDown={onEdit}
          >
            <Pencil className="h-3.5 w-3.5 text-primary" />
            Edit Schedule
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-foreground hover:bg-primary/10 flex items-center gap-2"
            onMouseDown={onPauseToggle}
          >
            {paused ? (
              <>
                <Play className="h-3.5 w-3.5 text-green-400" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5 text-yellow-400" />
                Pause
              </>
            )}
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-destructive hover:bg-destructive/10 flex items-center gap-2 border-t border-border/50"
            onMouseDown={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Job row ──────────────────────────────────────────────────────────────────

function JobRow({
  job,
  busyId,
  onEdit,
  onPauseToggle,
  onRunNow,
  onDelete,
}: {
  job: CronJob;
  busyId: string | null;
  onEdit: (job: CronJob) => void;
  onPauseToggle: (job: CronJob) => void;
  onRunNow: (job: CronJob) => void;
  onDelete: (job: CronJob) => void;
}) {
  const isPaused = job.status === "paused";
  const isBusy = busyId === job.id;

  return (
    <div
      className={cn(
        "grid grid-cols-12 items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 transition-colors hover:bg-surface-high/30",
        isPaused && "opacity-60"
      )}
    >
      <div className="col-span-12 sm:col-span-5 flex items-center gap-3 min-w-0">
        <div className="h-7 w-7 shrink-0 rounded-sm bg-primary/10 flex items-center justify-center">
          <Timer className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground truncate">
            {humaniseName(job.name)}
          </p>
          <p className="text-3xs text-muted-foreground font-mono truncate">
            {job.id}
          </p>
        </div>
      </div>

      <div className="col-span-4 sm:col-span-2">
        <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-0.5 font-bold">
          Interval
        </p>
        <p className="text-xs font-mono text-foreground">{job.trigger}</p>
      </div>

      <div className="col-span-5 sm:col-span-3">
        <p className="text-3xs uppercase tracking-wider text-muted-foreground mb-0.5 font-bold">
          Next Run
        </p>
        <p className={cn("text-xs font-mono", isPaused ? "text-yellow-400" : "text-foreground")}>
          {formatNextRun(job.next_run_time)}
        </p>
      </div>

      <div className="col-span-3 sm:col-span-2 flex justify-end items-center gap-2">
        <StatusBadge status={job.status} />
        <RowActions
          job={job}
          disabled={isBusy}
          onEdit={() => onEdit(job)}
          onPauseToggle={() => onPauseToggle(job)}
          onRunNow={() => onRunNow(job)}
          onDelete={() => onDelete(job)}
        />
      </div>
    </div>
  );
}

// ─── Skeleton row ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 border-b border-border/30">
      <div className="col-span-5 flex items-center gap-3">
        <Skeleton className="h-7 w-7 shrink-0 rounded-sm" />
        <div className="flex-1">
          <Skeleton className="h-3 w-32 mb-1" />
          <Skeleton className="h-2.5 w-24" />
        </div>
      </div>
      <div className="col-span-2">
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="col-span-3">
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="col-span-2 flex justify-end">
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

// ─── Edit / schedule form (shared by edit + add) ─────────────────────────────

type ScheduleForm = {
  triggerKind: "interval" | "cron";
  intervalMinutes: string;
  cronHour: string;
  cronMinute: string;
  cronDayOfWeek: string;
};

function emptyScheduleForm(): ScheduleForm {
  return {
    triggerKind: "interval",
    intervalMinutes: "",
    cronHour: "",
    cronMinute: "",
    cronDayOfWeek: "",
  };
}

function formFromJob(job: CronJob): ScheduleForm {
  if (job.trigger_type === "cron") {
    return {
      triggerKind: "cron",
      intervalMinutes: "",
      cronHour: job.cron_hour !== null ? String(job.cron_hour) : "",
      cronMinute: job.cron_minute !== null ? String(job.cron_minute) : "",
      cronDayOfWeek: job.cron_day_of_week ?? "",
    };
  }
  return {
    triggerKind: "interval",
    intervalMinutes: job.interval_minutes !== null ? String(job.interval_minutes) : "",
    cronHour: "",
    cronMinute: "",
    cronDayOfWeek: "",
  };
}

function ScheduleFields({
  form,
  onChange,
  disabled,
}: {
  form: ScheduleForm;
  onChange: (f: ScheduleForm) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-2xs uppercase tracking-widest text-muted-foreground font-bold">
          Schedule type
        </Label>
        <Select
          value={form.triggerKind}
          onValueChange={(v) =>
            onChange({ ...form, triggerKind: v as ScheduleForm["triggerKind"] })
          }
          disabled={disabled}
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="interval">Interval (every N minutes)</SelectItem>
            <SelectItem value="cron">Cron (time-of-day / day-of-week)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.triggerKind === "interval" ? (
        <div>
          <Label htmlFor="interval_minutes" className="text-2xs uppercase tracking-widest text-muted-foreground font-bold">
            Interval (minutes)
          </Label>
          <Input
            id="interval_minutes"
            type="number"
            min={1}
            max={10080}
            value={form.intervalMinutes}
            onChange={(e) =>
              onChange({ ...form, intervalMinutes: e.target.value })
            }
            placeholder="e.g. 15"
            disabled={disabled}
            className="mt-1.5"
          />
          <p className="text-3xs text-muted-foreground mt-1">
            Fires repeatedly every N minutes. 1–10080.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="cron_hour" className="text-2xs uppercase tracking-widest text-muted-foreground font-bold">
              Hour (UTC)
            </Label>
            <Input
              id="cron_hour"
              type="number"
              min={0}
              max={23}
              value={form.cronHour}
              onChange={(e) => onChange({ ...form, cronHour: e.target.value })}
              placeholder="0–23"
              disabled={disabled}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="cron_minute" className="text-2xs uppercase tracking-widest text-muted-foreground font-bold">
              Minute
            </Label>
            <Input
              id="cron_minute"
              type="number"
              min={0}
              max={59}
              value={form.cronMinute}
              onChange={(e) => onChange({ ...form, cronMinute: e.target.value })}
              placeholder="0–59"
              disabled={disabled}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="cron_dow" className="text-2xs uppercase tracking-widest text-muted-foreground font-bold">
              Day of week
            </Label>
            <Input
              id="cron_dow"
              value={form.cronDayOfWeek}
              onChange={(e) =>
                onChange({ ...form, cronDayOfWeek: e.target.value })
              }
              placeholder="mon-fri"
              disabled={disabled}
              className="mt-1.5"
            />
          </div>
          <p className="col-span-3 text-3xs text-muted-foreground">
            Leave fields blank to omit. Example: hour=21, minute=5, dow=mon-fri.
          </p>
        </div>
      )}
    </div>
  );
}

function buildScheduleBody(form: ScheduleForm):
  | { interval_minutes: number }
  | { cron_hour?: number; cron_minute?: number; cron_day_of_week?: string }
  | null {
  if (form.triggerKind === "interval") {
    const n = parseInt(form.intervalMinutes, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return { interval_minutes: n };
  }
  const body: { cron_hour?: number; cron_minute?: number; cron_day_of_week?: string } = {};
  if (form.cronHour.trim() !== "") {
    const h = parseInt(form.cronHour, 10);
    if (!Number.isFinite(h) || h < 0 || h > 23) return null;
    body.cron_hour = h;
  }
  if (form.cronMinute.trim() !== "") {
    const m = parseInt(form.cronMinute, 10);
    if (!Number.isFinite(m) || m < 0 || m > 59) return null;
    body.cron_minute = m;
  }
  if (form.cronDayOfWeek.trim() !== "") {
    body.cron_day_of_week = form.cronDayOfWeek.trim();
  }
  if (Object.keys(body).length === 0) return null;
  return body;
}

// ─── Edit dialog ─────────────────────────────────────────────────────────────

function EditDialog({
  job,
  onClose,
  onSave,
  pending,
}: {
  job: CronJob | null;
  onClose: () => void;
  onSave: (body: ReturnType<typeof buildScheduleBody>) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState<ScheduleForm>(() =>
    job ? formFromJob(job) : emptyScheduleForm()
  );
  // Reset the form each time a different job is opened. Using job?.id as dep
  // (not `job`) so object identity changes from a useQuery refetch don't clobber
  // an in-progress edit.
  useEffect(() => {
    if (job) setForm(formFromJob(job));
  }, [job?.id]);

  const body = buildScheduleBody(form);

  return (
    <Dialog open={!!job} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>
            {job && (
              <span className="font-mono text-xs text-foreground">{job.id}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <ScheduleFields form={form} onChange={setForm} disabled={pending} />
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={pending || body === null}
            onClick={() => onSave(body)}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add dialog ──────────────────────────────────────────────────────────────

function AddDialog({
  open,
  templates,
  onClose,
  onAdd,
  pending,
}: {
  open: boolean;
  templates: CronTemplate[];
  onClose: () => void;
  onAdd: (templateId: string, body: ReturnType<typeof buildScheduleBody>) => void;
  pending: boolean;
}) {
  const available = templates.filter((t) => !t.already_registered);
  const [selected, setSelected] = useState<string>("");
  const [useDefault, setUseDefault] = useState(true);
  const [form, setForm] = useState<ScheduleForm>(emptyScheduleForm());

  const template = templates.find((t) => t.id === selected);

  function handleSelect(id: string) {
    setSelected(id);
    const t = templates.find((x) => x.id === id);
    if (t) {
      setForm({
        triggerKind: t.trigger_type === "cron" ? "cron" : "interval",
        intervalMinutes: t.interval_minutes != null ? String(t.interval_minutes) : "",
        cronHour: t.cron_hour != null ? String(t.cron_hour) : "",
        cronMinute: t.cron_minute != null ? String(t.cron_minute) : "",
        cronDayOfWeek: t.cron_day_of_week ?? "",
      });
    }
  }

  const body = useDefault ? null : buildScheduleBody(form);
  const canSubmit = selected && (useDefault || body !== null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setSelected("");
          setUseDefault(true);
          setForm(emptyScheduleForm());
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add job</DialogTitle>
          <DialogDescription>
            Re-register a job from the template registry. Jobs already running
            are hidden — delete one first to re-add with a different cadence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-2xs uppercase tracking-widest text-muted-foreground font-bold">
              Template
            </Label>
            <Select value={selected} onValueChange={handleSelect} disabled={pending}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder={available.length === 0 ? "All templates are already registered" : "Select a job template"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {humaniseName(t.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {template && (
              <p className="text-3xs text-muted-foreground mt-1">
                {template.description}
              </p>
            )}
          </div>

          {template && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDefault}
                  onChange={(e) => setUseDefault(e.target.checked)}
                  disabled={pending}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-xs text-foreground">Use default schedule</span>
              </label>
              {!useDefault && (
                <ScheduleFields form={form} onChange={setForm} disabled={pending} />
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit || pending}
            onClick={() => onAdd(selected, body)}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete confirmation ─────────────────────────────────────────────────────

function DeleteDialog({
  job,
  onClose,
  onConfirm,
  pending,
}: {
  job: CronJob | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={!!job} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete job?</DialogTitle>
          <DialogDescription>
            Remove <span className="font-mono text-foreground">{job?.id}</span>{" "}
            from the scheduler. You can re-add it later from the Add dialog.
            Changes are lost on backend restart.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={pending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CronsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [deletingJob, setDeletingJob] = useState<CronJob | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const {
    data: jobs,
    isPending: jobsPending,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<CronJob[]>({
    queryKey: ["crons", "jobs"],
    queryFn: async () => {
      const result = await cronsApi.getJobs();
      setLastRefreshed(new Date());
      return result;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const { data: templates } = useQuery<CronTemplate[]>({
    queryKey: ["crons", "templates"],
    queryFn: () => cronsApi.getTemplates(),
    enabled: !!user,
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["crons", "jobs"] });
    void qc.invalidateQueries({ queryKey: ["crons", "templates"] });
  }

  const rescheduleMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: NonNullable<ReturnType<typeof buildScheduleBody>> }) =>
      cronsApi.reschedule(id, body),
    onSuccess: (job) => {
      toast.success(`Rescheduled ${job.id} — ${job.trigger}`);
      setEditingJob(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => cronsApi.remove(id),
    onSuccess: (_, id) => {
      toast.success(`Deleted ${id}`);
      setDeletingJob(null);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ReturnType<typeof buildScheduleBody> }) => {
      const payload = body ? { job_id: id, ...body } : { job_id: id };
      return cronsApi.add(payload);
    },
    onSuccess: (job) => {
      toast.success(`Added ${job.id} — ${job.trigger}`);
      setAddOpen(false);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pauseMut = useMutation({
    mutationFn: (job: CronJob) =>
      job.status === "paused" ? cronsApi.resume(job.id) : cronsApi.pause(job.id),
    onMutate: (job) => setBusyId(job.id),
    onSuccess: (job) => {
      toast.success(
        job.status === "paused" ? `Paused ${job.id}` : `Resumed ${job.id}`
      );
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => setBusyId(null),
  });

  const runNowMut = useMutation({
    mutationFn: (job: CronJob) => cronsApi.runNow(job.id),
    onMutate: (job) => setBusyId(job.id),
    onSuccess: (_job, job) => {
      toast.success(`Triggered ${job.id} — running now`);
      invalidate();
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => setBusyId(null),
  });

  const runningCount = jobs?.filter((j) => j.status === "running").length ?? 0;
  const pausedCount = jobs?.filter((j) => j.status === "paused").length ?? 0;
  const totalCount = jobs?.length ?? 0;
  const addableCount = templates?.filter((t) => !t.already_registered).length ?? 0;

  return (
    <AppShell title="Crons">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Scheduled Jobs
          </h2>
          <p className="text-2xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mt-0.5">
            APScheduler — Background Task Registry
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {totalCount > 0 && (
            <>
              <span className="px-2 py-1 text-2xs font-bold border bg-green-500/10 text-green-400 border-green-500/20">
                {runningCount} RUNNING
              </span>
              {pausedCount > 0 && (
                <span className="px-2 py-1 text-2xs font-bold border bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                  {pausedCount} PAUSED
                </span>
              )}
              <span className="px-2 py-1 text-2xs font-bold border bg-surface-highest text-muted-foreground border-border">
                {totalCount} TOTAL
              </span>
            </>
          )}

          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            disabled={addableCount === 0}
            className="h-8 px-3 text-2xs font-bold uppercase tracking-wider"
            title={addableCount === 0 ? "All templates already registered" : undefined}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Job
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="h-8 px-3 text-2xs font-bold uppercase tracking-wider border-border"
          >
            {isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      <section className="bg-surface-mid border border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <h3 className="text-2xs font-bold uppercase tracking-[0.2em] text-foreground">
              Job Registry
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-3xs text-muted-foreground uppercase tracking-wider">
              Auto-refreshes every 30s
            </span>
            {lastRefreshed !== null && (
              <span className="text-3xs text-muted-foreground font-mono">
                · Last:{" "}
                {lastRefreshed.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-border/30 bg-surface-lowest">
          <div className="col-span-12 sm:col-span-5">
            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Job
            </span>
          </div>
          <div className="col-span-4 sm:col-span-2">
            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Interval
            </span>
          </div>
          <div className="col-span-5 sm:col-span-3">
            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Next Run (Local)
            </span>
          </div>
          <div className="col-span-3 sm:col-span-2 text-right">
            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground/70">
              Status / Actions
            </span>
          </div>
        </div>

        {jobsPending ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
            <p className="text-2xs font-bold uppercase tracking-wider text-destructive">
              Failed to load jobs
            </p>
            <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
              {error instanceof Error ? error.message : "Could not reach the backend scheduler."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void refetch()}
              className="text-2xs uppercase tracking-wider mt-1"
            >
              <RefreshCw className="h-3 w-3 mr-1.5" />
              Retry
            </Button>
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center px-6">
            <Clock className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-2xs font-bold uppercase tracking-wider text-muted-foreground">
              No Jobs Registered
            </p>
            <p className="text-3xs text-muted-foreground max-w-xs leading-relaxed">
              The scheduler has no jobs registered. Use{" "}
              <span className="text-primary">Add Job</span> to restore one from a
              template.
            </p>
          </div>
        ) : (
          <div>
            {jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                busyId={busyId}
                onEdit={setEditingJob}
                onPauseToggle={(j) => pauseMut.mutate(j)}
                onRunNow={(j) => runNowMut.mutate(j)}
                onDelete={setDeletingJob}
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 text-3xs text-muted-foreground/50 uppercase tracking-wider">
        Times shown in your local timezone. Schedule changes apply immediately
        but are in-memory only — they reset to defaults on backend restart.
      </p>

      <EditDialog
        job={editingJob}
        onClose={() => setEditingJob(null)}
        pending={rescheduleMut.isPending}
        onSave={(body) => {
          if (!editingJob || body === null) return;
          rescheduleMut.mutate({ id: editingJob.id, body: body as NonNullable<typeof body> });
        }}
      />
      <DeleteDialog
        job={deletingJob}
        onClose={() => setDeletingJob(null)}
        pending={deleteMut.isPending}
        onConfirm={() => deletingJob && deleteMut.mutate(deletingJob.id)}
      />
      <AddDialog
        open={addOpen}
        templates={templates ?? []}
        onClose={() => setAddOpen(false)}
        pending={addMut.isPending}
        onAdd={(id, body) => addMut.mutate({ id, body })}
      />
    </AppShell>
  );
}
