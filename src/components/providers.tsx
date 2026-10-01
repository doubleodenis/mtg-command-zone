"use client";

import * as React from "react";
import { ToastProvider } from "@/components/ui/toast";
import { useNotificationRealtime } from "@/hooks/use-notification-realtime";
import { emitNewNotification } from "@/lib/notification-events";

interface ProvidersProps {
  children: React.ReactNode;
  userId?: string | null;
}

/**
 * Client-side providers wrapper.
 * Includes toast notifications and realtime subscriptions.
 */
export function Providers({ children, userId }: ProvidersProps) {
  return (
    <ToastProvider>
      <RealtimeSubscriber userId={userId ?? null} />
      {children}
    </ToastProvider>
  );
}

/**
 * Component that subscribes to realtime notifications.
 * Separated to avoid re-renders when toasts change.
 */
function RealtimeSubscriber({ userId }: { userId: string | null }) {
  // emitNewNotification is module-level, so it's a stable reference and
  // doesn't re-subscribe the realtime channel on every render.
  useNotificationRealtime({ userId, onNewNotification: emitNewNotification });
  return null;
}
