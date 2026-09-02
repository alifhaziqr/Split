/**
 * Thrown when core rejects something the *caller* supplied — a bad amount, an
 * unbalanced split, a malformed weight. An API layer maps this class to 422.
 *
 * Deliberately not thrown for a violated internal invariant (an 'unreachable:'
 * guard) or for settle.ts's re-checks of data read back from storage — those
 * are bugs or corrupted rows, not the caller's fault, and stay a bare Error
 * so they map to 500 instead.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
