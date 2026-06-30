export function sseEvent(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSseStream(runTask, { onCancel } = {}) {
  const encoder = new TextEncoder();
  let cancelled = false;

  const stream = new ReadableStream({
    async start(controller) {
      const queue = [];
      let resolveWait = null;
      let closed = false;

      const push = (event) => {
        if (closed) return;
        queue.push(event);
        resolveWait?.();
        resolveWait = null;
      };

      const waitForEvent = () =>
        new Promise((resolve) => {
          if (queue.length > 0) resolve();
          else resolveWait = resolve;
        });

      let taskDone = false;
      const task = (async () => {
        try {
          await runTask(push);
        } finally {
          taskDone = true;
          push(null);
        }
      })();

      try {
        while (true) {
          if (queue.length === 0) await waitForEvent();
          const event = queue.shift();
          if (event === null) break;
          controller.enqueue(encoder.encode(sseEvent(event)));
        }
      } finally {
        closed = true;
        if (!taskDone) {
          cancelled = true;
          onCancel?.();
        }
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
      onCancel?.();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
