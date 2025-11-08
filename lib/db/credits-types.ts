/**
 * Types and classes for credit system
 * Separate from server actions to avoid "use server" restrictions
 */

export class InsufficientCreditsError extends Error {
  constructor(
    public required: number,
    public available: number
  ) {
    super(`Insufficient credits. Required: ${required}, Available: ${available}`);
    this.name = "InsufficientCreditsError";
  }
}
