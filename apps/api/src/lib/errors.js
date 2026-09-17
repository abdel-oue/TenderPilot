/**
 * The single error shape the api ever returns:
 * `{ error: "Human readable message", code: "SNAKE_CASE_CODE" }`.
 */
export class AppError extends Error {
  /**
   * @param {string} message human readable, shown to the user
   * @param {string} code SNAKE_CASE_CODE
   * @param {number} status HTTP status code
   */
  constructor(message, code, status) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
  }

  /** @returns {{ error: string, code: string }} the wire body */
  toBody() {
    return { error: this.message, code: this.code };
  }
}

/**
 * @param {string} message
 * @param {string} code
 * @param {number} [status]
 * @returns {AppError}
 */
export function appError(message, code, status = 400) {
  return new AppError(message, code, status);
}
