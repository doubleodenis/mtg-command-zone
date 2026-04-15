/**
 * Notification Supabase Query Helpers
 *
 * All queries for notifications including fetching, marking read/seen,
 * and dismissing notifications.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result, UUID } from '@/types'
import type { NotificationWithActor, NotificationData } from '@/types/notification'
import { mapNotificationRow, mapProfileSummary } from '@/types/database-mappers'
import type { ProfileSummary } from '@/types/profile'

// ============================================
// Notification Queries
// ============================================

/**
 * Get notifications for a user
 */
export async function getNotifications(
  client: SupabaseClient<Database>,
  userId: string,
  options: {
    limit?: number
    includeRead?: boolean
    includeDismissed?: boolean
  } = {}
): Promise<Result<NotificationWithActor[]>> {
  const { limit = 20, includeRead = true, includeDismissed = false } = options

  let query = client
    .from('notifications')
    .select(`
      *,
      actor:profiles!notifications_actor_id_fkey (
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Filter out dismissed unless explicitly requested
  if (!includeDismissed) {
    query = query.is('dismissed_at', null)
  }

  // Filter out read if requested
  if (!includeRead) {
    query = query.is('read_at', null)
  }

  // Filter out expired notifications
  query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  const notifications: NotificationWithActor[] = data.map((row) => {
    const baseNotification = mapNotificationRow(row)
    const actor: ProfileSummary | null = row.actor
      ? mapProfileSummary({
          id: row.actor.id,
          username: row.actor.username,
          display_name: row.actor.display_name ?? null,
          avatar_url: row.actor.avatar_url,
          created_at: null,
        })
      : null

    return {
      ...baseNotification,
      data: row.data as NotificationData,
      actor,
    }
  })

  return { success: true, data: notifications }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<number>> {
  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null)
    .is('dismissed_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: count ?? 0 }
}

/**
 * Get unseen notification count for a user (for badge display)
 */
export async function getUnseenNotificationCount(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<number>> {
  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('seen_at', null)
    .is('dismissed_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: count ?? 0 }
}

// ============================================
// Notification Mutations
// ============================================

/**
 * Mark notifications as seen (when dropdown is opened)
 */
export async function markNotificationsSeen(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<number>> {
  const { data, error } = await client.rpc('mark_notifications_seen', {
    p_recipient_id: userId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? 0 }
}

/**
 * Mark specific notifications as read (when clicked)
 */
export async function markNotificationsRead(
  client: SupabaseClient<Database>,
  userId: string,
  notificationIds?: UUID[]
): Promise<Result<number>> {
  const { data, error } = await client.rpc('mark_notifications_read', {
    p_recipient_id: userId,
    p_notification_ids: notificationIds,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data ?? 0 }
}

/**
 * Dismiss a notification (hide from list without deleting)
 */
export async function dismissNotification(
  client: SupabaseClient<Database>,
  notificationId: UUID,
  userId: string
): Promise<Result<void>> {
  const { error } = await client
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_id', userId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: undefined }
}

/**
 * Dismiss all notifications for a user
 */
export async function dismissAllNotifications(
  client: SupabaseClient<Database>,
  userId: string
): Promise<Result<void>> {
  const { error } = await client.rpc('dismiss_notifications', {
    p_recipient_id: userId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: undefined }
}
