/**
 * In-page signal from the realtime subscription (providers.tsx) to the
 * notification dropdown (navbar). They live in separate component trees, and
 * the dropdown's list is seeded from server props, so without this it never
 * learns about rows inserted after the page rendered.
 */

export const NEW_NOTIFICATION_EVENT = 'commandzone:new-notification'

export function emitNewNotification(): void {
  window.dispatchEvent(new Event(NEW_NOTIFICATION_EVENT))
}

export function subscribeToNewNotifications(listener: () => void): () => void {
  window.addEventListener(NEW_NOTIFICATION_EVENT, listener)
  return () => window.removeEventListener(NEW_NOTIFICATION_EVENT, listener)
}
