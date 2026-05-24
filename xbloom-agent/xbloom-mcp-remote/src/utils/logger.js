const levelOrder = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const redactedKeys = ["password", "token", "authorization", "session", "secret"];

function redact(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object") return value;

  const output = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    const keyLower = key.toLowerCase();
    if (redactedKeys.some((candidate) => keyLower.includes(candidate))) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redact(fieldValue);
  }
  return output;
}

export class Logger {
  constructor(level = "info") {
    this.minimumLevel = levelOrder[level] ?? levelOrder.info;
  }

  write(level, message, meta = undefined) {
    if ((levelOrder[level] ?? levelOrder.info) < this.minimumLevel) return;

    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    if (meta) payload.meta = redact(meta);

    process.stderr.write(`${JSON.stringify(payload)}\n`);
  }

  debug(message, meta) {
    this.write("debug", message, meta);
  }

  info(message, meta) {
    this.write("info", message, meta);
  }

  warn(message, meta) {
    this.write("warn", message, meta);
  }

  error(message, meta) {
    this.write("error", message, meta);
  }
}
