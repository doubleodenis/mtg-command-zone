/**
 * Format Supabase Query Helpers
 *
 * All queries for game formats.
 * Validates and casts config jsonb at the boundary.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { Result } from '@/types'
import type { Format, FormatSummary, FormatConfig, FormatSlug } from '@/types/format'
import { mapFormatRow, mapFormatSummary } from '@/types/database-mappers'

// ============================================
// Format Config Validation
// ============================================

/**
 * Validate and cast format config jsonb
 */
function validateFormatConfig(data: unknown, slug: string): FormatConfig {
  if (!data || typeof data !== 'object') {
    // Return default config based on slug
    return getDefaultConfig(slug as FormatSlug)
  }

  const obj = data as Record<string, unknown>

  switch (obj.format) {
    case '1v1':
      return { format: '1v1', teamCount: 2, playersPerTeam: 1 }
    case '2v2':
      return { format: '2v2', teamCount: 2, playersPerTeam: 2 }
    case '3v3':
      return { format: '3v3', teamCount: 2, playersPerTeam: 3 }
    case 'ffa':
      return { format: 'ffa', teamCount: null, playersPerTeam: null }
    case 'pentagram':
      return {
        format: 'pentagram',
        playerCount: 5,
        adjacencyMap: (obj.adjacencyMap as Record<number, [number, number]>) ?? {
          0: [1, 4],
          1: [0, 2],
          2: [1, 3],
          3: [2, 4],
          4: [3, 0],
        },
      }
    default:
      return getDefaultConfig(slug as FormatSlug)
  }
}

/**
 * Get default config for a format slug
 */
function getDefaultConfig(slug: FormatSlug): FormatConfig {
  switch (slug) {
    case '1v1':
      return { format: '1v1', teamCount: 2, playersPerTeam: 1 }
    case '2v2':
      return { format: '2v2', teamCount: 2, playersPerTeam: 2 }
    case '3v3':
      return { format: '3v3', teamCount: 2, playersPerTeam: 3 }
    case 'ffa':
      return { format: 'ffa', teamCount: null, playersPerTeam: null }
    case 'pentagram':
      return {
        format: 'pentagram',
        playerCount: 5,
        adjacencyMap: {
          0: [1, 4],
          1: [0, 2],
          2: [1, 3],
          3: [2, 4],
          4: [3, 0],
        },
      }
  }
}

// ============================================
// Format Queries
// ============================================

/**
 * Get all active formats
 */
export async function getFormats(
  client: SupabaseClient<Database>
): Promise<Result<Format[]>> {
  const { data, error } = await client
    .from('formats')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: data.map((row) => ({
      ...mapFormatRow(row),
      config: validateFormatConfig(row.config, row.slug),
    })),
  }
}

/**
 * Get format summaries for selection UI
 */
export async function getFormatSummaries(
  client: SupabaseClient<Database>
): Promise<Result<FormatSummary[]>> {
  const { data, error } = await client
    .from('formats')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data.map(mapFormatSummary) }
}

/**
 * Get a format by ID
 */
export async function getFormatById(
  client: SupabaseClient<Database>,
  formatId: string
): Promise<Result<Format>> {
  const { data, error } = await client
    .from('formats')
    .select('*')
    .eq('id', formatId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      ...mapFormatRow(data),
      config: validateFormatConfig(data.config, data.slug),
    },
  }
}

/**
 * Get a format by slug
 */
export async function getFormatBySlug(
  client: SupabaseClient<Database>,
  slug: FormatSlug
): Promise<Result<Format>> {
  const { data, error } = await client
    .from('formats')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    data: {
      ...mapFormatRow(data),
      config: validateFormatConfig(data.config, data.slug),
    },
  }
}

/**
 * Get default format (FFA - most commonly used)
 */
export async function getDefaultFormat(
  client: SupabaseClient<Database>
): Promise<Result<Format>> {
  return getFormatBySlug(client, 'ffa')
}
