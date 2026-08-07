/**
 * Turn an unknown thrown value into something a user can read.
 *
 * `err.message` on a value typed `unknown` is how "Cannot read properties of
 * undefined" ends up rendered where the actual failure should have been, so the
 * shape is checked rather than assumed.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return 'Unknown error'
}
