export type ClassValue = string | false | null | undefined;

export function clsx(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}
