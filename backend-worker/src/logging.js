/**
 * Structured Logging Utilities
 * Provides consistent JSON-formatted logging with correlation IDs
 */

/**
 * Create structured log entry
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Log message
 * @param {Object} context - Additional context (correlationId, pathname, etc.)
 * @returns {string} JSON-formatted log string
 */
function createLogEntry(level, message, context = {}) {
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
 * @param {Object} context - Additional context
 */
function logInfo(message, context = {}) {
  console.log(createLogEntry('info', message, context));
}

/**
 * Log warning message with structured format
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
function logWarn(message, context = {}) {
  console.warn(createLogEntry('warn', message, context));
}

/**
 * Log error message with structured format
 * @param {string} message - Log message
 * @param {Error|Object} error - Error object or context
 * @param {Object} context - Additional context
 */
function logError(message, error = {}, context = {}) {
  const errorContext = {
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
 * @param {Object} context - Additional context
 */
function logDebug(message, context = {}) {
  console.log(createLogEntry('debug', message, context));
}

export {
  createLogEntry,
  logInfo,
  logWarn,
  logError,
  logDebug
};

