export class AppError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message, details) {
    super(400, "bad_request", message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required.") {
    super(401, "unauthorized", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message) {
    super(404, "not_found", message);
  }
}

export class UpstreamError extends AppError {
  constructor(message, details) {
    super(502, "upstream_error", message, details);
  }
}

export function toAppError(error) {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(500, "internal_error", error.message);
  return new AppError(500, "internal_error", "Unexpected error.");
}
