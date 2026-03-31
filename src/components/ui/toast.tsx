"use client";

import * as React from "react";
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
    success: <CheckIcon className="w-5 h-5 text-success" />,
    error: <XCircleIcon className="w-5 h-5 text-danger" />,
    warning: <AlertIcon className="w-5 h-5 text-warning" />,
    info: <InfoIcon className="w-5 h-5 text-accent" />,
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
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
