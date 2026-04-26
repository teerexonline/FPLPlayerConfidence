/** Joins truthy class strings. Sufficient for this project's non-conflicting Tailwind usage. */
export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter((c): c is string => Boolean(c)).join(' ');
}
