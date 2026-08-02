import type { Params } from "nestjs-pino";

/**
 * Logs structurés JSON (Handbook 2.7) : timestamp, level, trace_id (via le
 * genReqId), module, message. pino-pretty uniquement en développement.
 */
export const pinoConfig: Params = {
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? "info",
    genReqId: (req) => req.headers["x-trace-id"] ?? crypto.randomUUID(),
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { singleLine: true } }
        : undefined,
    redact: ["req.headers.authorization", "req.headers.cookie"],
  },
};
