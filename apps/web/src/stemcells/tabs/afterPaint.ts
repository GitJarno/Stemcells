interface TaskScheduler {
  postTask(
    task: () => void,
    options: { priority: "user-blocking"; signal: AbortSignal },
  ): Promise<void>;
}

/**
 * Runs `task` once the frame under way has drawn, and returns its cancel. Ahead of the tasks
 * waiting, where the browser has priorities: with chats streaming, a plain task waited behind
 * a second of their renders. A hidden window draws no frames: there, without waiting for one.
 */
export function afterPaint(task: () => void): () => void {
  const scheduler = (globalThis as { scheduler?: TaskScheduler }).scheduler;
  const stop = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const queue = () => {
    if (typeof scheduler?.postTask !== "function") timer = setTimeout(task);
    // A cancelled task rejects its promise: nothing to say about that.
    else
      void scheduler
        .postTask(task, { priority: "user-blocking", signal: stop.signal })
        .catch(() => undefined);
  };
  const frame = document.hidden ? undefined : requestAnimationFrame(queue);
  if (frame === undefined) queue();
  return () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    clearTimeout(timer);
    stop.abort();
  };
}
