"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Toast Types
// ============================================

export type ToastType = "default" | "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

// ============================================
// Toast Context
// ============================================

type ToastContextValue = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Convenience function for creating toasts
export function toast(options: Omit<Toast, "id">) {
  // This will be called from outside React components
  // We need to store handlers globally
  if (typeof window !== "undefined" && (window as ToastWindow).__toastHandler) {
    return (window as ToastWindow).__toastHandler!(options);
  }
  console.warn("Toast provider not mounted");
  return "";
}

type ToastWindow = typeof window & {
  __toastHandler?: (options: Omit<Toast, "id">) => string;
};

// ============================================
// Toast Provider
// ============================================

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? DEFAULT_DURATION,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, newToast.duration);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = React.useCallback(() => {
    setToasts([]);
  }, []);

  // Register global handler
  React.useEffect(() => {
    (window as ToastWindow).__toastHandler = addToast;
    return () => {
      delete (window as ToastWindow).__toastHandler;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// ============================================
// Toast Container & Item
// ============================================

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onRemove: () => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(onRemove, 150); // Match animation duration
  };

  const typeStyles: Record<ToastType, string> = {
    default: "border-card-border",
    success: "border-l-4 border-l-success border-card-border",
    error: "border-l-4 border-l-danger border-card-border",
    warning: "border-l-4 border-l-warning border-card-border",
    info: "border-l-4 border-l-accent border-card-border",
  };

  const iconMap: Record<ToastType, React.ReactNode> = {
    default: null,
    success: <CheckCircle2 className="w-5 h-5 text-success" />,
    error: <XCircle className="w-5 h-5 text-danger" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning" />,
    info: <Info className="w-5 h-5 text-accent" />,
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-80 rounded-lg border bg-card shadow-lg",
        "animate-in slide-in-from-right-full fade-in-0 duration-200",
        isExiting && "animate-out slide-out-to-right-full fade-out-0 duration-150",
        typeStyles[toast.type]
      )}
      role="alert"
    >
      <div className="flex items-start gap-3 p-4">
        {iconMap[toast.type] && (
          <div className="shrink-0 mt-0.5">{iconMap[toast.type]}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-1">{toast.title}</p>
          {toast.description && (
            <p className="text-sm text-text-2 mt-1">{toast.description}</p>
          )}
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                handleRemove();
              }}
              className="mt-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleRemove}
          className="shrink-0 p-1 text-text-3 hover:text-text-2 transition-colors rounded"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


