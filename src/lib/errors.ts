/**
 * User-friendly error messages for common error scenarios.
 * Maps technical errors to human-readable messages.
 */

// Common error codes and their user-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  // Auth errors
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/email-already-in-use': 'This email is already registered.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/session-expired': 'Your session has expired. Please sign in again.',
  'auth/unauthorized': 'You don\'t have permission to perform this action.',
  
  // Network errors
  'network/offline': 'You appear to be offline. Please check your connection.',
  'network/timeout': 'Request timed out. Please try again.',
  'network/server-error': 'Our servers are having issues. Please try again later.',
  
  // Database errors
  'db/not-found': 'The requested item was not found.',
  'db/duplicate': 'This item already exists.',
  'db/constraint-violation': 'This action cannot be completed due to existing dependencies.',
  
  // Validation errors
  'validation/required': 'This field is required.',
  'validation/invalid-format': 'Please enter a valid format.',
  'validation/too-long': 'This text is too long.',
  'validation/too-short': 'This text is too short.',
  
  // Rate limiting
  'rate-limit/exceeded': 'Too many requests. Please wait a moment and try again.',
}

// Match patterns for Postgres/Supabase errors
const POSTGRES_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { 
    pattern: /duplicate key value violates unique constraint/i, 
    message: 'This item already exists.' 
  },
  { 
    pattern: /violates foreign key constraint/i, 
    message: 'This action cannot be completed because it references data that no longer exists.' 
  },
  { 
    pattern: /violates not-null constraint/i, 
    message: 'A required field is missing.' 
  },
  { 
    pattern: /permission denied/i, 
    message: 'You don\'t have permission to perform this action.' 
  },
  {
    pattern: /row-level security/i,
    message: 'You don\'t have permission to access this resource.'
  },
  {
    pattern: /JWT expired/i,
    message: 'Your session has expired. Please sign in again.'
  },
  {
    pattern: /invalid input syntax/i,
    message: 'Invalid data format provided.'
  },
]

/**
 * Convert a technical error to a user-friendly message.
 */
export function getUserFriendlyError(error: unknown): string {
  // Handle null/undefined
  if (!error) {
    return 'An unexpected error occurred. Please try again.'
  }

  // Handle Error objects
  if (error instanceof Error) {
    return getMessageFromErrorString(error.message)
  }

  // Handle string errors
  if (typeof error === 'string') {
    return getMessageFromErrorString(error)
  }

  // Handle objects with error/message property
  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, unknown>
    const message = errObj.message || errObj.error || errObj.error_description
    if (typeof message === 'string') {
      return getMessageFromErrorString(message)
    }
  }

  return 'An unexpected error occurred. Please try again.'
}

function getMessageFromErrorString(message: string): string {
  // Check for known error codes
  if (ERROR_MESSAGES[message]) {
    return ERROR_MESSAGES[message]
  }

  // Check for Postgres error patterns
  for (const { pattern, message: friendlyMessage } of POSTGRES_ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return friendlyMessage
    }
  }

  // If the message is already user-friendly (doesn't contain technical terms), return it
  const technicalTerms = [
    'constraint',
    'violation',
    'syntax',
    'token',
    'undefined',
    'null',
    'exception',
    'stacktrace',
    'at line',
    'SQLSTATE',
    'relation',
    'column',
  ]

  const hasTechnicalTerms = technicalTerms.some((term) =>
    message.toLowerCase().includes(term.toLowerCase())
  )

  if (!hasTechnicalTerms && message.length < 200) {
    // Capitalize first letter and ensure it ends with punctuation
    let cleaned = message.trim()
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.'
    }
    return cleaned
  }

  return 'An unexpected error occurred. Please try again.'
}

/**
 * Error message presets for common UI scenarios
 */
export const ERROR_PRESETS = {
  // Loading states
  loadMatches: 'Unable to load matches. Please try again.',
  loadDecks: 'Unable to load decks. Please try again.',
  loadCollections: 'Unable to load collections. Please try again.',
  loadProfile: 'Unable to load profile. Please try again.',
  loadNotifications: 'Unable to load notifications. Please try again.',
  
  // Action failures
  createMatch: 'Failed to create match. Please try again.',
  confirmMatch: 'Failed to confirm match. Please try again.',
  createDeck: 'Failed to create deck. Please try again.',
  updateDeck: 'Failed to update deck. Please try again.',
  deleteDeck: 'Failed to delete deck. Please try again.',
  createCollection: 'Failed to create collection. Please try again.',
  updateCollection: 'Failed to update collection. Please try again.',
  deleteCollection: 'Failed to delete collection. Please try again.',
  addToCollection: 'Failed to add match to collection. Please try again.',
  sendFriendRequest: 'Failed to send friend request. Please try again.',
  
  // Auth
  signIn: 'Unable to sign in. Please check your credentials.',
  signOut: 'Unable to sign out. Please try again.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  
  // Generic
  generic: 'Something went wrong. Please try again.',
  offline: 'You appear to be offline. Please check your connection.',
  serverError: 'Our servers are experiencing issues. Please try again later.',
} as const

export type ErrorPreset = keyof typeof ERROR_PRESETS
