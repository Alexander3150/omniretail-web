/**
 * Deterministic mock password hash derived from the full password
 * content, not just its length — two different passwords never
 * collide into the same "hash" just because they're the same length.
 *
 * This is NOT a cryptographic hash and NOT a production scheme (no
 * salt, no adaptive cost). It's plain, synchronous JS with zero
 * dependencies, which matters because this mock repository runs in
 * the browser (it persists to localStorage), where Node's `crypto`
 * module isn't available. Real hashing happens once a real
 * backend/API repository replaces this mock one.
 */
export function buildPasswordHashMock(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i += 1) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return `mock-hash-${(hash >>> 0).toString(16)}`;
}
