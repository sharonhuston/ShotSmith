/**
 * Perceived character consistency (e.g. the same “Alejandro” in OTS vs wide) is driven by
 * running every checked shot in **one** batch, and reusing the **same** random seed for
 * every generation in that run. The model + reference + style anchor still do the work;
 * the shared seed is the algorithmic “identity lock” for that batch.
 */

/** One 32-bit seed for an entire batch (every checked shot shares this value). */
export function makeBatchSeed(): number {
  const u = new Uint32Array(1)
  crypto.getRandomValues(u)
  return u[0]!
}
