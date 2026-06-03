/**
 * utils/response.ts
 * STAB-09: Shared response helpers extracted from admin.ts and public.ts
 * to eliminate code duplication and ensure consistent API response format.
 */

export const ok = (data: any, msg: string = 'success') =>
  ({ status: true, message: msg, response: data });

export const err = (msg: string = 'error') =>
  ({ status: false, message: msg });

/**
 * Parse STRING_AGG result → first item as object
 */
export const parseFirst = (val: string | null, fields: string[], delim: string = ',') => {
  if (!val) return null;
  const parts = val.split(delim)[0].split('|#|');
  return Object.fromEntries(fields.map((f, i) => [f, parts[i] || '']));
};

/**
 * Parse STRING_AGG result → array of objects
 */
export const parseList = (val: string | null, parser: (s: string) => any, delim: string = ',') =>
  val ? val.split(delim).map(parser).filter(Boolean) : [];
