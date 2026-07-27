/**
 * One-way channel from the API layer to the auth store.
 *
 * The 401 interceptor needs to log the user out, but the auth store already
 * imports `api` — importing it back would form a require cycle. The store
 * registers a handler here instead, and this module imports nothing, so both
 * sides depend only on it.
 */
type UnauthorizedHandler = () => void | Promise<void>;

let handler: UnauthorizedHandler | null = null;

/** Register the logout routine. Called once, by the auth store. */
export function setUnauthorizedHandler(fn: UnauthorizedHandler): void {
  handler = fn;
}

/** Fire-and-forget: the interceptor must not await the logout. */
export function emitUnauthorized(): void {
  void handler?.();
}
