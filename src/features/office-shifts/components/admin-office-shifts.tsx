"use client";

import { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Plus,
  Edit2,
  Play,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  getOfficeSchedulingConfigurationAction,
  createOfficeShiftAction,
  updateOfficeShiftAction,
  previewOfficeShiftActivationAction,
  activateOfficeShiftAction,
  enableFullDaySchedulingAction,
} from "../actions/office-shift-actions";
import {
  formatShiftHours,
  minuteToTimeStr,
  timeStrToMinute,
} from "../utils/shift-client-utils";
import { formatColomboInterval } from "@/features/reservations/utils/client-date";

export type ShiftMode = "MORNING" | "EVENING" | "NIGHT" | "FULL_DAY" | "CUSTOM";

export interface ShiftRecord {
  id: string;
  name: string;
  mode: ShiftMode;
  description: string | null;
  startMinute: number;
  durationMinutes: number;
  isActive: boolean;
  updatedByUserId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ActivationImpactRecord {
  shiftId: string;
  conflictCount: number;
  conflicts: Array<{
    id: string;
    resourceId: string;
    departmentId: string | null;
    startTime: Date | string;
    endTime: Date | string;
    status: "PENDING" | "APPROVED";
  }>;
  truncated: boolean;
  impactToken: string;
  explanation: string;
}

export function AdminOfficeShifts() {
  const router = useRouter();
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [, startTransition] = useTransition();

  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [enforced, setEnforced] = useState(false);
  const [fallback, setFallback] = useState<{
    name: string;
    startMinute: number;
    durationMinutes: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modal: Create / Edit Shift
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMode, setFormMode] = useState<ShiftMode>("MORNING");
  const [formDescription, setFormDescription] = useState("");
  const [formStartTime, setFormStartTime] = useState("08:00");
  const [formDurationHours, setFormDurationHours] = useState(8);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Modal: Activation Impact & Confirmation
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [targetShift, setTargetShift] = useState<ShiftRecord | null>(null);
  const [impact, setImpact] = useState<ActivationImpactRecord | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  const fetchConfig = useCallback(() => {
    setIsLoading(true);
    getOfficeSchedulingConfigurationAction()
      .then((res) => {
        if (res.success && res.data) {
          setShifts(res.data.shifts as unknown as ShiftRecord[]);
          setActiveShiftId(res.data.activeShiftId);
          setEnforced(res.data.enforced);
          setFallback(res.data.fallback);
        } else {
          toastRef.current.error("Failed to load scheduling policies.");
        }
      })
      .catch((err) => {
        console.error("Failed to fetch office scheduling config:", err);
        toastRef.current.error("Unable to load shift configuration.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    let isCurrent = true;
    void Promise.resolve().then(() => {
      if (isCurrent) {
        fetchConfig();
      }
    });
    return () => {
      isCurrent = false;
    };
  }, [fetchConfig]);

  // Open Create Form with a specific Preset
  const handleOpenPreset = (preset: {
    name: string;
    mode: ShiftMode;
    start: string;
    duration: number;
    description: string;
  }) => {
    setEditingShiftId(null);
    setFormName(preset.name);
    setFormMode(preset.mode);
    setFormDescription(preset.description);
    setFormStartTime(preset.start);
    setFormDurationHours(preset.duration);
    setFormFieldErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Form for inactive shift
  const handleOpenEdit = (shift: ShiftRecord) => {
    if (shift.isActive) {
      toast.error("Active shifts cannot be edited in place. Create an inactive definition, then activate it.");
      return;
    }
    setEditingShiftId(shift.id);
    setFormName(shift.name);
    setFormMode(shift.mode);
    setFormDescription(shift.description || "");
    setFormStartTime(minuteToTimeStr(shift.startMinute));
    setFormDurationHours(shift.durationMinutes / 60);
    setFormFieldErrors({});
    setIsFormModalOpen(true);
  };

  // Submit Create or Update
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFieldErrors({});
    setIsSubmittingForm(true);

    const startMinute = timeStrToMinute(formStartTime);
    const durationMinutes = formMode === "FULL_DAY" ? 1440 : Math.round(formDurationHours * 60);

    try {
      if (editingShiftId) {
        const res = await updateOfficeShiftAction({
          id: editingShiftId,
          name: formName.trim(),
          mode: formMode,
          description: formDescription.trim() || null,
          startMinute,
          durationMinutes,
        });

        if (res.success) {
          toast.success("Shift definition updated successfully.");
          setIsFormModalOpen(false);
          fetchConfig();
          startTransition(() => router.refresh());
        } else {
          if (res.fieldErrors) setFormFieldErrors(res.fieldErrors);
          toast.error(res.error || "Failed to update shift definition.");
        }
      } else {
        const res = await createOfficeShiftAction({
          name: formName.trim(),
          mode: formMode,
          description: formDescription.trim() || null,
          startMinute,
          durationMinutes,
        });

        if (res.success) {
          toast.success("New shift policy created.");
          setIsFormModalOpen(false);
          fetchConfig();
          startTransition(() => router.refresh());
        } else {
          if (res.fieldErrors) setFormFieldErrors(res.fieldErrors);
          toast.error(res.error || "Failed to create shift policy.");
        }
      }
    } catch (err) {
      console.error("Save shift failed:", err);
      toast.error("Unexpected error saving shift.");
    } finally {
      setIsSubmittingForm(false);
    }
  };

  // Preview & Activate Handler
  const handleInitiateActivation = async (shift: ShiftRecord) => {
    if (shift.isActive) {
      toast.info("This scheduling policy is already active.");
      return;
    }

    setIsActivating(true);
    setTargetShift(shift);

    try {
      const previewRes = await previewOfficeShiftActivationAction(shift.id);
      if (!previewRes.success) {
        toast.error(previewRes.error || "Failed to preview shift activation impact.");
        setIsActivating(false);
        return;
      }
      if (!previewRes.data) {
        toast.error("Failed to preview shift activation impact.");
        setIsActivating(false);
        return;
      }

      const impactData = previewRes.data as unknown as ActivationImpactRecord;
      setImpact(impactData);

      // If zero conflicts, activate directly
      if (impactData.conflictCount === 0) {
        const actRes =
          shift.mode === "FULL_DAY"
            ? await enableFullDaySchedulingAction({ shiftId: shift.id })
            : await activateOfficeShiftAction({ shiftId: shift.id });

        if (actRes.success) {
          toast.success(`Activated "${shift.name}" with zero conflicts!`);
          fetchConfig();
          startTransition(() => router.refresh());
        } else {
          toast.error(actRes.error || "Activation failed.");
        }
        setIsActivating(false);
      } else {
        // Has conflicts: show impact confirmation dialog
        setIsActivating(false);
        setIsImpactModalOpen(true);
      }
    } catch (err) {
      console.error("Preview activation error:", err);
      toast.error("Failed to evaluate activation impact.");
      setIsActivating(false);
    }
  };

  // Confirm Activation with Conflicts
  const handleConfirmActivation = async () => {
    if (!targetShift || !impact) return;
    setIsActivating(true);

    try {
      const actRes =
        targetShift.mode === "FULL_DAY"
          ? await enableFullDaySchedulingAction({
              shiftId: targetShift.id,
              confirmImpactToken: impact.impactToken,
            })
          : await activateOfficeShiftAction({
              shiftId: targetShift.id,
              confirmImpactToken: impact.impactToken,
            });

      if (actRes.success) {
        toast.success(`Policy activated: ${targetShift.name}. Impacted reservations preserved.`);
        setIsImpactModalOpen(false);
        setImpact(null);
        setTargetShift(null);
        fetchConfig();
        startTransition(() => router.refresh());
      } else {
        if (actRes.code === "STALE_IMPACT_PREVIEW" && actRes.impact) {
          toast.info("Bookings changed during review. Updated conflict list loaded.");
          setImpact(actRes.impact as unknown as ActivationImpactRecord);
        } else {
          toast.error(actRes.error || "Activation confirmation failed.");
        }
      }
    } catch (err) {
      console.error("Confirm activation error:", err);
      toast.error("Unexpected error confirming activation.");
    } finally {
      setIsActivating(false);
    }
  };

  const activeShift = shifts.find((s) => s.id === activeShiftId);

  const getModeIcon = (mode: ShiftMode) => {
    switch (mode) {
      case "MORNING":
        return <Sun className="h-4 w-4 text-amber-500" />;
      case "EVENING":
        return <Sunset className="h-4 w-4 text-orange-500" />;
      case "NIGHT":
        return <Moon className="h-4 w-4 text-indigo-500" />;
      case "FULL_DAY":
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <Layers className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Scheduling Policy */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Policy
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                enforced
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-slate-100 text-slate-600 border border-slate-200"
              )}
            >
              {enforced ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Enforced
                </>
              ) : (
                "Unenforced Fallback"
              )}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 truncate">
              {activeShift ? activeShift.name : fallback?.name || "Display Fallback"}
            </h3>
            <p className="text-xs text-blue-600 font-semibold mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>
                {activeShift
                  ? formatShiftHours(activeShift.startMinute, activeShift.durationMinutes)
                  : fallback
                  ? formatShiftHours(fallback.startMinute, fallback.durationMinutes)
                  : "09:00 AM – 06:00 PM"}
              </span>
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            {activeShift?.description ||
              "Standard hours apply to booking timelines. Activate a policy below to change operational boundaries."}
          </p>
        </div>

        {/* Card 2: Configured Definitions */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Configured Policies
          </span>
          <p className="text-3xl font-extrabold text-slate-900">{shifts.length}</p>
          <p className="text-xs text-slate-500">
            {shifts.filter((s) => s.isActive).length} active · {shifts.filter((s) => !s.isActive).length} inactive definitions stored in PostgreSQL
          </p>
        </div>

        {/* Card 3: Timezone & Safety */}
        <div className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Timezone &amp; Protection
          </span>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-bold text-slate-900">Asia/Colombo (UTC+05:30)</span>
          </div>
          <p className="text-xs text-slate-500">
            Advisory locks guarantee atomic activation. Existing reservations outside new windows remain unchanged and visible.
          </p>
        </div>
      </div>

      {/* Preset Quick-Creation Buttons */}
      <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Quick Shift Presets</span>
            </h4>
            <p className="text-xs text-slate-500">
              Instantly create predefined operational windows per technical specification.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleOpenPreset({
                name: "Custom Workspace Hours",
                mode: "CUSTOM",
                start: "09:00",
                duration: 9,
                description: "Custom operational shift tailored for team needs.",
              })
            }
            className="text-xs h-8 rounded-xl font-semibold border-slate-300"
          >
            <Plus className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Custom Shift
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() =>
              handleOpenPreset({
                name: "Standard Morning Shift",
                mode: "MORNING",
                start: "08:00",
                duration: 8,
                description: "Standard daytime business hours (08:00 to 16:00).",
              })
            }
            className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left flex items-start gap-2.5 group"
          >
            <Sun className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                Morning Shift
              </p>
              <p className="text-[11px] text-slate-500">08:00 – 16:00 (8h)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenPreset({
                name: "Evening Shift",
                mode: "EVENING",
                start: "16:00",
                duration: 8,
                description: "Evening operations up to midnight boundary (16:00 to 00:00).",
              })
            }
            className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left flex items-start gap-2.5 group"
          >
            <Sunset className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                Evening Shift
              </p>
              <p className="text-[11px] text-slate-500">16:00 – 00:00 (8h)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenPreset({
                name: "Night Operation Shift",
                mode: "NIGHT",
                start: "22:00",
                duration: 8,
                description: "Overnight shift crossing midnight into next day (22:00 to 06:00 +1d).",
              })
            }
            className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left flex items-start gap-2.5 group"
          >
            <Moon className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                Night Shift
              </p>
              <p className="text-[11px] text-slate-500">22:00 – 06:00 (+1d)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              handleOpenPreset({
                name: "24-Hour Continuous Facility",
                mode: "FULL_DAY",
                start: "00:00",
                duration: 24,
                description: "Continuous 24-hour round-the-clock booking availability (00:00 to 24:00).",
              })
            }
            className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left flex items-start gap-2.5 group"
          >
            <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700">
                24-Hour Mode
              </p>
              <p className="text-[11px] text-slate-500">00:00 – 24:00 (1440m)</p>
            </div>
          </button>
        </div>
      </div>

      {/* Shifts Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Stored Scheduling Policies</h3>
            <p className="text-xs text-slate-500">
              Configure and activate shift windows that govern timeline rendering and allowed booking hours.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {shifts.length} {shifts.length === 1 ? "definition" : "definitions"}
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span>Loading scheduling configuration...</span>
          </div>
        ) : shifts.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No shift definitions created yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Currently running on the deterministic 09:00–18:00 display fallback. Click any preset above to create your first active policy.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {shifts.map((shift) => (
              <div
                key={shift.id}
                className={cn(
                  "p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                  shift.isActive ? "bg-blue-50/30" : "hover:bg-slate-50/50"
                )}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                      shift.isActive
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    )}
                  >
                    {getModeIcon(shift.mode)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900">{shift.name}</h4>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {shift.mode}
                      </span>
                      {shift.isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Active Policy
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{formatShiftHours(shift.startMinute, shift.durationMinutes)}</span>
                      <span className="text-slate-400 font-normal">
                        ({Math.round((shift.durationMinutes / 60) * 10) / 10} hours duration)
                      </span>
                    </p>

                    {shift.description && (
                      <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                        {shift.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {!shift.isActive ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(shift)}
                        className="h-8 px-2.5 text-xs text-slate-700 rounded-lg border-slate-200"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        disabled={isActivating}
                        onClick={() => handleInitiateActivation(shift)}
                        className="h-8 px-3 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-2xs flex items-center gap-1.5"
                      >
                        <Play className="h-3.5 w-3.5" />
                        <span>Activate Policy</span>
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                      Currently Operating
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: Create or Edit Shift */}
      {isFormModalOpen && (
        <Modal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingShiftId ? "Edit Inactive Shift" : "Create Scheduling Policy"}
        >
          <form onSubmit={handleSaveShift} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Shift Name *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Standard Morning Shift"
                className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              {formFieldErrors.name && (
                <p className="text-xs text-rose-600 mt-1">{formFieldErrors.name[0]}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Shift Mode *
                </label>
                <select
                  value={formMode}
                  onChange={(e) => {
                    const m = e.target.value as ShiftMode;
                    setFormMode(m);
                    if (m === "FULL_DAY") {
                      setFormStartTime("00:00");
                      setFormDurationHours(24);
                    }
                  }}
                  className="w-full h-9 rounded-xl border border-slate-300 bg-white px-2.5 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="MORNING">MORNING (Daytime hours)</option>
                  <option value="EVENING">EVENING (Up to midnight)</option>
                  <option value="NIGHT">NIGHT (Crosses midnight)</option>
                  <option value="FULL_DAY">FULL_DAY (24-Hour continuous)</option>
                  <option value="CUSTOM">CUSTOM (Flexible hours)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Start Time (Asia/Colombo) *
                </label>
                <input
                  type="time"
                  required
                  disabled={formMode === "FULL_DAY"}
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Duration (Hours) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={24}
                  step={0.5}
                  disabled={formMode === "FULL_DAY"}
                  value={formDurationHours}
                  onChange={(e) => setFormDurationHours(parseFloat(e.target.value) || 1)}
                  className="w-full h-9 rounded-xl border border-slate-300 px-3 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                />
                {formMode === "FULL_DAY" && (
                  <p className="text-[11px] text-blue-600 mt-1">
                    Full-day mode requires exact 24 hours (1440 minutes).
                  </p>
                )}
                {formFieldErrors.durationMinutes && (
                  <p className="text-xs text-rose-600 mt-1">
                    {formFieldErrors.durationMinutes[0]}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Effective Operational Span
                </label>
                <div className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center text-xs font-semibold text-slate-700">
                  {formatShiftHours(
                    timeStrToMinute(formStartTime),
                    formMode === "FULL_DAY" ? 1440 : Math.round(formDurationHours * 60)
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Description (Optional)
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Operational purpose or facility access details..."
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingForm}
                className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmittingForm ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : editingShiftId ? (
                  "Update Shift"
                ) : (
                  "Create Shift"
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 2: Activation Impact & Confirmation with Future Booking Conflicts */}
      {isImpactModalOpen && targetShift && impact && (
        <Modal
          isOpen={isImpactModalOpen}
          onClose={() => setIsImpactModalOpen(false)}
          title={`Confirm Activation: ${targetShift.name}`}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 space-y-1">
                <p className="font-bold">
                  {impact.conflictCount} Future Bookings Outside Proposed Shift
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Activating this policy will shift the daily operational window to{" "}
                  <span className="font-bold">
                    {formatShiftHours(targetShift.startMinute, targetShift.durationMinutes)}
                  </span>
                  . Future reservations listed below do not fit this new recurring shift window.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>Zero Data Loss Guarantee:</strong> All existing bookings remain unchanged,
                approved, and visible in timelines and history.
              </span>
            </div>

            {/* List of Affected Bookings */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Impacted Active Reservations (Showing first {impact.conflicts.length}):
              </label>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                {impact.conflicts.map((c) => (
                  <div key={c.id} className="p-2.5 text-xs flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">Booking ID: {c.id.slice(0, 8)}...</p>
                      <p className="text-[11px] text-slate-500">
                        {formatColomboInterval(c.startTime, c.endTime)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        c.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
              {impact.truncated && (
                <p className="text-[11px] text-slate-400 italic">
                  Additional {impact.conflictCount - 100} bookings omitted from preview list.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsImpactModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isActivating}
                onClick={handleConfirmActivation}
                className="h-9 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center gap-1.5"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Confirming...
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Activate Policy</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
