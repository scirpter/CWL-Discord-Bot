import type { Result, ResultAsync } from "neverthrow";

import type { AppError } from "@/domain/errors.js";

export type AppResult<T> = Result<T, AppError>;
export type AppResultAsync<T> = ResultAsync<T, AppError>;
