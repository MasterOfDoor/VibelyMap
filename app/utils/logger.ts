"use client";

/**
 * Centralized logging system for VibelyMap
 * Provides structured logging with different log levels
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    // Use typeof window check for client-side compatibility
    this.isDevelopment = 
      (typeof window !== "undefined" && process.env.NODE_ENV === "development") ||
      (typeof process !== "undefined" && process.env.NODE_ENV === "development");
    this.isProduction = 
      (typeof window !== "undefined" && process.env.NODE_ENV === "production") ||
      (typeof process !== "undefined" && process.env.NODE_ENV === "production");
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
        },
      }),
    };

    return JSON.stringify(logEntry, null, this.isDevelopment ? 2 : 0);
  }

  private shouldLog(level: LogLevel): boolean {
    // Development: Tüm loglar
    if (this.isDevelopment) return true;

    // Production: Sadece warn ve error
    if (this.isProduction) {
      return level === "warn" || level === "error";
    }

    // Preview/Test: info, warn, error
    return level !== "debug";
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, context, error);

    switch (level) {
      case "debug":
        console.debug(formatted);
        break;
      case "info":
        console.log(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "error":
        console.error(formatted);
        break;
    }
  }

  debug(message: string, context?: LogContext) {
    this.log("debug", message, context);
  }

  info(message: string, context?: LogContext) {
    this.log("info", message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log("warn", message, context);
  }

  error(message: string, context?: LogContext, error?: Error) {
    this.log("error", message, context, error);
  }

  // Specialized loggers for different modules
  gemini(message: string, context?: LogContext, error?: Error) {
    this.log("info", `[Gemini] ${message}`, { module: "gemini", ...context }, error);
  }

  geminiError(message: string, context?: LogContext, error?: Error) {
    this.log("error", `[Gemini] ${message}`, { module: "gemini", ...context }, error);
  }

  chatgpt(message: string, context?: LogContext, error?: Error) {
    this.log("info", `[ChatGPT] ${message}`, { module: "chatgpt", ...context }, error);
  }

  chatgptError(message: string, context?: LogContext, error?: Error) {
    this.log("error", `[ChatGPT] ${message}`, { module: "chatgpt", ...context }, error);
  }

  storage(message: string, context?: LogContext, error?: Error) {
    this.log("info", `[Storage] ${message}`, { module: "storage", ...context }, error);
  }

  storageError(message: string, context?: LogContext, error?: Error) {
    this.log("error", `[Storage] ${message}`, { module: "storage", ...context }, error);
  }

  analysis(message: string, context?: LogContext, error?: Error) {
    this.log("info", `[Analysis] ${message}`, { module: "analysis", ...context }, error);
  }

  analysisError(message: string, context?: LogContext, error?: Error) {
    this.log("error", `[Analysis] ${message}`, { module: "analysis", ...context }, error);
  }

  api(message: string, context?: LogContext, error?: Error) {
    this.log("info", `[API] ${message}`, { module: "api", ...context }, error);
  }

  apiError(message: string, context?: LogContext, error?: Error) {
    this.log("error", `[API] ${message}`, { module: "api", ...context }, error);
  }
}

// Singleton instance
export const logger = new Logger();

// Convenience exports
export const log = {
  debug: (message: string, context?: LogContext) => logger.debug(message, context),
  info: (message: string, context?: LogContext) => logger.info(message, context),
  warn: (message: string, context?: LogContext) => logger.warn(message, context),
  error: (message: string, context?: LogContext, error?: Error) =>
    logger.error(message, context, error),
  gemini: (message: string, context?: LogContext, error?: Error) =>
    logger.gemini(message, context, error),
  geminiError: (message: string, context?: LogContext, error?: Error) =>
    logger.geminiError(message, context, error),
  chatgpt: (message: string, context?: LogContext, error?: Error) =>
    logger.chatgpt(message, context, error),
  chatgptError: (message: string, context?: LogContext, error?: Error) =>
    logger.chatgptError(message, context, error),
  storage: (message: string, context?: LogContext, error?: Error) =>
    logger.storage(message, context, error),
  storageError: (message: string, context?: LogContext, error?: Error) =>
    logger.storageError(message, context, error),
  analysis: (message: string, context?: LogContext, error?: Error) =>
    logger.analysis(message, context, error),
  analysisError: (message: string, context?: LogContext, error?: Error) =>
    logger.analysisError(message, context, error),
  api: (message: string, context?: LogContext, error?: Error) =>
    logger.api(message, context, error),
  apiError: (message: string, context?: LogContext, error?: Error) =>
    logger.apiError(message, context, error),
};

