/** Joins conditional class names, dropping falsy entries. No `clsx` dependency needed for this. */
export function cn(...classes: readonly (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
