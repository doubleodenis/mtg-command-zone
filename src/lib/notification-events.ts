/**
 * In-page signal that the user's notifications changed, so the navbar
 * dropdown should refetch its list and unseen count. The dropdown's state is
 * seeded from server props and its layout persists across navigation, so
 * without this it never learns about changes made elsewhere:
 * - a new row arriving over realtime (providers.tsx)
 * - the /notifications page marking a backlog as seen (notification-list.tsx)
 */

export const NOTIFICATIONS_CHANGED_EVENT = 'commandzone:notifications-changed'

export function emitNotificationsChanged(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT))
}

export function subscribeToNotificationsChanged(listener: () => void): () => void {
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, listener)
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, listener)
}
