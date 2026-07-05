import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

function toErrorMeta(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }
  return { errorMessage: String(error) };
}

function write(level: LogLevel, event: string, payload: LogPayload): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...payload,
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function createRequestId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function logInfo(event: string, payload: LogPayload = {}): void {
  write("info", event, payload);
}

export function logWarn(event: string, payload: LogPayload = {}): void {
  write("warn", event, payload);
}

export function logError(
  event: string,
  error: unknown,
  payload: LogPayload = {},
): void {
  write("error", event, { ...payload, ...toErrorMeta(error) });
}
