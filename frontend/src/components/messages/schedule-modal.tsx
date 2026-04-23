"use client";

import { useState, useMemo } from "react";
import { Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { apiPost } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";

interface ScheduleModalProps {
  messageId: string;
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

function getQuickOptions(): { label: string; date: Date }[] {
  const now = new Date();

  const tomorrow9am = new Date(now);
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  const in2hours = new Date(now);
  in2hours.setHours(in2hours.getHours() + 2);

  const nextMonday = new Date(now);
  const dayOfWeek = nextMonday.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
  nextMonday.setHours(9, 0, 0, 0);

  return [
    { label: "Tomorrow 9 AM", date: tomorrow9am },
    { label: "In 2 hours", date: in2hours },
    { label: "Monday 9 AM", date: nextMonday },
  ];
}

function toLocalDatetimeString(d: Date): { date: string; time: string } {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

export function ScheduleModal({
  messageId,
  isOpen,
  onClose,
  onScheduled,
}: ScheduleModalProps) {
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("09:00");
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezone = useMemo(() => {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }, []);

  const quickOptions = useMemo(() => getQuickOptions(), []);

  const selectedDateTime = useMemo(() => {
    if (!dateValue || !timeValue) return null;
    return new Date(`${dateValue}T${timeValue}`);
  }, [dateValue, timeValue]);

  const isValidFuture = selectedDateTime && selectedDateTime > new Date();

  const handleQuickOption = (date: Date) => {
    const { date: d, time: t } = toLocalDatetimeString(date);
    setDateValue(d);
    setTimeValue(t);
  };

  const handleSchedule = async () => {
    if (!selectedDateTime) return;
    setIsScheduling(true);
    setError(null);
    try {
      await apiPost(`/messages/${messageId}/schedule`, {
        scheduledFor: selectedDateTime.toISOString(),
      });
      handleClose();
      onScheduled();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to schedule message"
      );
    } finally {
      setIsScheduling(false);
    }
  };

  const handleClose = () => {
    setDateValue("");
    setTimeValue("09:00");
    setError(null);
    onClose();
  };

  // Minimum date is today
  const minDate = toLocalDatetimeString(new Date()).date;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Schedule Send">
      <div className="space-y-5">
        {/* Quick Options */}
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-600">
            Quick Options
          </label>
          <div className="flex flex-wrap gap-2">
            {quickOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleQuickOption(option.date)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
              >
                <Clock className="h-3.5 w-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Picker */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Date
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateValue}
                min={minDate}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Time
            </label>
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
            </div>
          </div>
        </div>

        {/* Timezone */}
        <p className="text-xs text-gray-500">
          Timezone: <span className="font-medium text-gray-700">{timezone}</span>
        </p>

        {/* Selected time preview */}
        {selectedDateTime && isValidFuture && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 px-4 py-3">
            <p className="text-sm font-medium text-primary-700">
              Scheduled for: {formatDateTime(selectedDateTime.toISOString())}
            </p>
          </div>
        )}

        {selectedDateTime && !isValidFuture && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Please select a time in the future.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            isLoading={isScheduling}
            disabled={!isValidFuture}
          >
            <Calendar className="mr-1.5 h-4 w-4" />
            Schedule Send
          </Button>
        </div>
      </div>
    </Modal>
  );
}
