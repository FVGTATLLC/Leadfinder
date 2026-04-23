"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
}

interface ToastItem extends ToastOptions {
  id: string;
  createdAt: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const typeConfig: Record<
  ToastType,
  { icon: typeof CheckCircle2; bg: string; border: string; iconColor: string; progressColor: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-white",
    border: "border-green-200",
    iconColor: "text-green-500",
    progressColor: "bg-green-500",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-white",
    border: "border-red-200",
    iconColor: "text-red-500",
    progressColor: "bg-red-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-white",
    border: "border-yellow-200",
    iconColor: "text-yellow-500",
    progressColor: "bg-yellow-500",
  },
  info: {
    icon: Info,
    bg: "bg-white",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    progressColor: "bg-blue-500",
  },
};

function ToastComponent({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = item.duration ?? 5000;
  const config = typeConfig[item.type ?? "info"];
  const Icon = config.icon;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(intervalRef.current!);
        setIsExiting(true);
        setTimeout(() => onDismiss(item.id), 300);
      }
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [duration, item.id, onDismiss]);

  const handleDismiss = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsExiting(true);
    setTimeout(() => onDismiss(item.id), 300);
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "pointer-events-auto relative w-80 overflow-hidden rounded-xl border shadow-lg transition-all duration-300",
        config.bg,
        config.border,
        isExiting
          ? "translate-x-full opacity-0"
          : "translate-x-0 opacity-100 animate-in slide-in-from-right-full"
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <Icon className={cn("mt-0.5 h-5 w-5 flex-shrink-0", config.iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{item.title}</p>
          {item.description && (
            <p className="mt-1 text-sm text-gray-500">{item.description}</p>
          )}
          {item.action && (
            <button
              onClick={item.action.onClick}
              className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              {item.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 w-full bg-gray-100">
        <div
          className={cn("h-full transition-all duration-100 ease-linear", config.progressColor)}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((options: ToastOptions): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: ToastItem = { ...options, id, createdAt: Date.now() };
    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2"
      >
        {toasts.map((item) => (
          <ToastComponent key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
