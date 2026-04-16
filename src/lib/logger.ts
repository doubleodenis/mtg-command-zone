/**
 * Structured logger for server-side logging.
 * Provides consistent formatting and context for debugging.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, message, context, error } = entry;
  const levelColor = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m',  // green
    warn: '\x1b[33m',  // yellow
    error: '\x1b[31m', // red
  }[level];
  const reset = '\x1b[0m';
  
  let output = `${levelColor}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`;
  
  if (context && Object.keys(context).length > 0) {
    output += `\n  Context: ${JSON.stringify(context, null, 2).replace(/\n/g, '\n  ')}`;
  }
  
  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.code) {
      output += `\n  Code: ${error.code}`;
    }
    if (error.stack && process.env.NODE_ENV === 'development') {
      output += `\n  Stack: ${error.stack}`;
    }
  }
  
  return output;
}

function createLogEntry(
  level: LogLevel,
  message: string,
  contextOrError?: LogContext | Error,
  maybeError?: Error
): LogEntry {
  const timestamp = new Date().toISOString();
  const entry: LogEntry = { timestamp, level, message };
  
  // Handle overloaded parameters
  if (contextOrError instanceof Error) {
    entry.error = {
      name: contextOrError.name,
      message: contextOrError.message,
      stack: contextOrError.stack,
      code: (contextOrError as Error & { code?: string }).code,
    };
  } else if (contextOrError) {
    entry.context = contextOrError;
    if (maybeError) {
      entry.error = {
        name: maybeError.name,
        message: maybeError.message,
        stack: maybeError.stack,
        code: (maybeError as Error & { code?: string }).code,
      };
    }
  }
  
  return entry;
}

/**
 * Logger instance with structured logging methods.
 * 
 * Usage:
 *   logger.info('User logged in', { userId: '123' });
 *   logger.error('Failed to create match', { matchId }, error);
 *   logger.warn('Rate limit approaching', { remaining: 5 });
 */
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = createLogEntry('debug', message, context);
      console.debug(formatLogEntry(entry));
    }
  },
  
  info(message: string, context?: LogContext): void {
    const entry = createLogEntry('info', message, context);
    console.info(formatLogEntry(entry));
  },
  
  warn(message: string, context?: LogContext): void {
    const entry = createLogEntry('warn', message, context);
    console.warn(formatLogEntry(entry));
  },
  
  error(message: string, contextOrError?: LogContext | Error, maybeError?: Error): void {
    const entry = createLogEntry('error', message, contextOrError, maybeError);
    console.error(formatLogEntry(entry));
  },
  
  /**
   * Log a Supabase error with full context.
   */
  supabaseError(operation: string, error: unknown, context?: LogContext): void {
    const entry = createLogEntry('error', `Supabase ${operation} failed`, context);
    
    if (error && typeof error === 'object') {
      const e = error as Record<string, unknown>;
      entry.error = {
        name: 'SupabaseError',
        message: (e.message as string) || 'Unknown error',
        code: (e.code as string) || (e.status as string)?.toString(),
      };
      
      // Include additional Supabase error details
      if (e.details || e.hint || e.status) {
        entry.context = {
          ...entry.context,
          details: e.details,
          hint: e.hint,
          status: e.status,
          statusText: e.statusText,
        };
      }
    }
    
    console.error(formatLogEntry(entry));
  },
  
  /**
   * Log an auth-related event or error.
   */
  auth(event: string, context?: LogContext, error?: Error): void {
    if (error) {
      const entry = createLogEntry('error', `[Auth] ${event}`, context, error);
      console.error(formatLogEntry(entry));
    } else {
      const entry = createLogEntry('info', `[Auth] ${event}`, context);
      console.info(formatLogEntry(entry));
    }
  },
};

export default logger;
