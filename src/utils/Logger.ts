/**
 * Structured logging service for E2E tests
 * Provides consistent, searchable, and actionable logging
 */
export interface LogContext {
  page?: string;
  action?: string;
  element?: string;
  timeout?: number;
  attempt?: number;
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'step';

export class Logger {
  private static _instance: Logger;
  private readonly isCI: boolean;
  private readonly isDebugMode: boolean;
  private stepCounter = 0;

  private constructor() {
    this.isCI = !!process.env.CI;
    this.isDebugMode = process.env.DEBUG === 'true';
  }

  public static getInstance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  step(page: string, action: string, context: LogContext = {}): void {
    this.stepCounter++;
    const emoji = this.getStepEmoji(action);
    const message = `${emoji} [${this.stepCounter}] ${page}: ${action}`;
    this.log('step', message, { page, action, ...context });
  }

  success(message: string, context: LogContext = {}): void {
    this.log('info', `✅ ${message}`, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('warn', `⚠️ ${message}`, context);
  }

  error(message: string, error?: Error, context: LogContext = {}): void {
    const errorDetails = error ? ` - ${error.message}` : '';
    this.log('error', `❌ ${message}${errorDetails}`, {
      ...context,
      stack: error?.stack
    });
  }

  debug(message: string, context: LogContext = {}): void {
    if (this.isDebugMode) {
      this.log('debug', `DEBUG: ${message}`, context);
    }
  }

  info(message: string, context: LogContext = {}): void {
    this.log('info', `ℹ️ ${message}`, context);
  }

  performance(operation: string, duration: number, context: LogContext = {}): void {
    const formattedDuration = duration > 1000
      ? `${(duration / 1000).toFixed(2)}s`
      : `${duration}ms`;

    this.log('info', `⚡ ${operation} completed in ${formattedDuration}`, {
      ...context,
      duration,
      performance: true
    });
  }

  retry(operation: string, attempt: number, maxAttempts: number, error?: Error): void {
    const message = `Retry ${attempt}/${maxAttempts}: ${operation}`;
    const level = attempt === maxAttempts ? 'error' : 'warn';

    this.log(level, message, {
      operation,
      attempt,
      maxAttempts,
      isLastAttempt: attempt === maxAttempts,
      error: error?.message
    });
  }

  summary(title: string, items: string[]): void {
    this.log('info', `${title}:`);
    items.forEach(item => {
      this.log('info', `  ${item}`);
    });
  }

  forPage(pageName: string) {
    return {
      step: (action: string, context: LogContext = {}) =>
        this.step(pageName, action, context),
      success: (message: string, context: LogContext = {}) =>
        this.success(message, { ...context, page: pageName }),
      warn: (message: string, context: LogContext = {}) =>
        this.warn(message, { ...context, page: pageName }),
      error: (message: string, error?: Error, context: LogContext = {}) =>
        this.error(message, error, { ...context, page: pageName }),
      debug: (message: string, context: LogContext = {}) =>
        this.debug(message, { ...context, page: pageName }),
      info: (message: string, context: LogContext = {}) =>
        this.info(message, { ...context, page: pageName }),
    };
  }

  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    if (this.isCI) {
      if (level === 'error' ||
          (level === 'warn' && !message.includes('App page loaded but no content detected')) ||
          (level === 'info' && (
            message.includes('✅ Test passed') ||
            message.includes('❌ Test failed') ||
            message.includes('E2E Test Config:')
          ))) {
        console.log(message);
      }
    } else {
      console.log(message);

      if (this.isDebugMode && Object.keys(context).length > 0) {
        console.log('  Context:', JSON.stringify(context, null, 2));
      }
    }
  }

  private getStepEmoji(action: string): string {
    const actionLower = action.toLowerCase();

    if (actionLower.includes('navigate') || actionLower.includes('goto')) return '🧭';
    if (actionLower.includes('click')) return '👆';
    if (actionLower.includes('type') || actionLower.includes('fill')) return '⌨️';
    if (actionLower.includes('wait') || actionLower.includes('loading')) return '⏳';
    if (actionLower.includes('verify') || actionLower.includes('check')) return '🔍';
    if (actionLower.includes('install') || actionLower.includes('deploy')) return '📦';
    if (actionLower.includes('screenshot')) return '📸';
    if (actionLower.includes('menu') || actionLower.includes('button')) return '🔘';

    return '🔧';
  }
}

export const logger = Logger.getInstance();
