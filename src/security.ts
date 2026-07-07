/**
 * Injection defense: everything from the outside world (calendar titles, email,
 * message text) is wrapped so the model treats it as DATA, never instructions.
 */
export function untrusted(payload: unknown, source = "world"): string {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return `<untrusted source="${source}">\n${body}\n</untrusted>`;
}
