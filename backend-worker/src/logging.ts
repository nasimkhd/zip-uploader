/**
 * Structured Logging Utilities
 * Provides consistent JSON-formatted logging with correlation IDs
 */

import type { LogContext } from './types.js';

/**
 * Create structured log entry
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {LogContext} context - Additional context (correlationId, pathname, etc.)
 * @returns {string} JSON-formatted log string
 */
function createLogEntry(level: string, message: string, context: LogContext = {}): string {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context
  };
  
  return JSON.stringify(entry);
}

/**
 * Log info message with structured format
 * @param {string} message - Log message
 * @param {LogContext} context - Additional context
 */
export function logInfo(message: string, context: LogContext = {}): void {
  console.log(createLogEntry('info', message, context));
}

/**
 * Log warning message with structured format
 * @param {string} message - Log message
 * @param {LogContext} context - Additional context
 */
export function logWarn(message: string, context: LogContext = {}): void {
  console.warn(createLogEntry('warn', message, context));
}

/**
 * Log error message with structured format
 * @param {string} message - Log message
 * @param {Error|LogContext} error - Error object or context
 * @param {LogContext} context - Additional context
 */
export function logError(message: string, error: Error | LogContext = {}, context: LogContext = {}): void {
  const errorContext: LogContext = {
    ...context,
    error: error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : error
  };
  
  console.error(createLogEntry('error', message, errorContext));
}

/**
 * Log debug message with structured format
 * @param {string} message - Log message
 * @param {LogContext} context - Additional context
 */
export function logDebug(message: string, context: LogContext = {}): void {
  console.log(createLogEntry('debug', message, context));
}

export {
  createLogEntry,
};

