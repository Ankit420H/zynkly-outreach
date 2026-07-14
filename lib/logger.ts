type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function createLog(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    context,
    data,
    timestamp: new Date().toISOString(),
  };
}

export const logger = {
  info(message: string, context?: string, data?: Record<string, unknown>) {
    const entry = createLog("info", message, context, data);
    console.log(JSON.stringify(entry));
  },
  warn(message: string, context?: string, data?: Record<string, unknown>) {
    const entry = createLog("warn", message, context, data);
    console.warn(JSON.stringify(entry));
  },
  error(message: string, context?: string, data?: Record<string, unknown>) {
    const entry = createLog("error", message, context, data);
    console.error(JSON.stringify(entry));
  },
  debug(message: string, context?: string, data?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "development") {
      const entry = createLog("debug", message, context, data);
      console.debug(JSON.stringify(entry));
    }
  },
};
