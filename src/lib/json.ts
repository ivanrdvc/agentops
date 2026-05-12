// JSON-serializable value. Used wherever a Span field crosses a server-
// function boundary — TanStack Start's serialization guard rejects `unknown`,
// so we declare JSON-shaped values explicitly.
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// Try-parse: returns parsed JSON on success, undefined on failure or non-string
// input. JSON.parse is typed `any` in the stdlib; assigning to `JsonValue` here
// is structurally correct — JSON.parse can only produce JSON-shaped output.
export function parseJson(v: unknown): JsonValue | undefined {
  if (typeof v !== 'string' || !v) return undefined
  try {
    return JSON.parse(v)
  } catch {
    return undefined
  }
}
