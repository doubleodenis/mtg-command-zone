/**
 * Mock Data Utilities
 *
 * Shared utilities for generating mock data.
 */

import type { ISODateString, UUID } from '@/types'

// ============================================
// ID Generation
// ============================================

let idCounter = 0

/**
 * Generate a unique mock UUID
 */
export function generateMockId(): UUID {
  idCounter++
  return `mock-${idCounter.toString().padStart(8, '0')}`
}

/**
 * Reset ID counter (useful for tests)
 */
export function resetMockIds(): void {
  idCounter = 0
}

/**
 * Generate a mock ISO date string
 * @param daysAgo - Number of days in the past (0 = today)
 */
export function generateMockDate(daysAgo = 0): ISODateString {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  return date.toISOString()
}
