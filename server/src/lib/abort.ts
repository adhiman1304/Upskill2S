/**
 * Runs `run` with a short-lived child of `parent`. The child aborts when the parent does, and the
 * listener on the parent is removed when `run` settles.
 *
 * The OpenAI SDK adds an `abort` listener to the signal of every request attempt and never removes
 * it, so passing one long-lived signal to many calls leaks listeners and triggers Node's
 * MaxListenersExceededWarning. Give each OpenAI call (and each job) its own child signal instead.
 */
export async function withChildSignal<T>(parent: AbortSignal, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const onAbort = () => controller.abort(parent.reason)
  if (parent.aborted) controller.abort(parent.reason)
  else parent.addEventListener('abort', onAbort, { once: true })
  try {
    return await run(controller.signal)
  } finally {
    parent.removeEventListener('abort', onAbort)
  }
}
