type LogFields = Record<string, unknown>;

const REDACT_KEYS = new Set(["authorization", "cookie", "set-cookie"]);

function redact(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = REDACT_KEYS.has(key.toLowerCase()) ? "[redacted]" : value;
  }
  return out;
}

function log(level: "info" | "warn" | "error", fields: LogFields, message?: string) {
  const entry = { level, ...redact(fields), msg: message };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (fields: LogFields, message?: string) => log("info", fields, message),
  warn: (fields: LogFields, message?: string) => log("warn", fields, message),
  error: (fields: LogFields, message?: string) => log("error", fields, message),
};
