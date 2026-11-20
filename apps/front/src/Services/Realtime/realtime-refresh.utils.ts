type TimeoutScheduler = {
  now: () => number
  setTimeout: (callback: () => void, delayMs: number) => number
  clearTimeout: (handle: number) => void
}

const browserScheduler: TimeoutScheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: handle => window.clearTimeout(handle)
}

/**
 * Coalesce bursty topic notifications so one public channel cannot force an
 * unbounded number of page refetches per client.
 */
export function createThrottledTopicRefresh(
  callback: () => void,
  minimumIntervalMs = 1_000,
  scheduler: TimeoutScheduler = browserScheduler
): { notify: () => void; cancel: () => void } {
  let lastExecutionAt = Number.NEGATIVE_INFINITY
  let timeout: number | undefined
  let cancelled = false

  const notify = () => {
    if (cancelled) return

    const now = scheduler.now()
    const elapsed = now - lastExecutionAt
    if (elapsed >= minimumIntervalMs) {
      lastExecutionAt = now
      callback()
      return
    }

    if (timeout !== undefined) return

    timeout = scheduler.setTimeout(() => {
      timeout = undefined
      if (cancelled) return
      lastExecutionAt = scheduler.now()
      callback()
    }, Math.max(0, minimumIntervalMs - elapsed))
  }

  const cancel = () => {
    cancelled = true
    if (timeout === undefined) return
    scheduler.clearTimeout(timeout)
    timeout = undefined
  }

  return { notify, cancel }
}
