export class AppError extends Error {
  public readonly code: string;
  public readonly publicMessage: string;
  public readonly causeData?: unknown;

  public constructor(code: string, publicMessage: string, options?: { causeData?: unknown }) {
    super(publicMessage);
    this.name = "AppError";
    this.code = code;
    this.publicMessage = publicMessage;
    this.causeData = options?.causeData;
  }
}

export function toAppError(input: unknown, fallbackCode = "UNKNOWN_ERROR"): AppError {
  if (input instanceof AppError) {
    return input;
  }

  if (input instanceof Error) {
    return new AppError(fallbackCode, input.message, { causeData: input });
  }

  return new AppError(fallbackCode, "An unexpected error occurred.", { causeData: input });
}
