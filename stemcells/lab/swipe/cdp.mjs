// Lab rig: a minimal DevTools-protocol client for the lab app's page.
const PORT = Number(process.env.LAB_CDP_PORT ?? 9377);

export async function targets() {
  const response = await fetch(`http://127.0.0.1:${PORT}/json`);
  return response.json();
}

export async function connect(pick = (target) => target.type === "page") {
  const list = await targets();
  const target = list.find(pick);
  if (!target) throw new Error(`no page target among ${JSON.stringify(list.map((t) => t.url))}`);
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let next = 1;
  const waiting = new Map();
  const listeners = new Map();
  socket.addEventListener("message", (message) => {
    const data = JSON.parse(message.data);
    if (data.id !== undefined) {
      const entry = waiting.get(data.id);
      waiting.delete(data.id);
      if (data.error) entry?.reject(new Error(JSON.stringify(data.error)));
      else entry?.resolve(data.result);
      return;
    }
    for (const listener of listeners.get(data.method) ?? []) listener(data.params);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = next++;
      waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const on = (method, listener) => {
    listeners.set(method, [...(listeners.get(method) ?? []), listener]);
  };
  const evaluate = async (expression, awaitPromise = true) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails.exception ?? result.exceptionDetails));
    }
    return result.result.value;
  };
  return { send, on, evaluate, close: () => socket.close(), target };
}

// node cdp.mjs '<expression>'  evaluates in the page and prints the value.
if (import.meta.url === `file://${process.argv[1]}`) {
  const page = await connect();
  const value = await page.evaluate(process.argv[2] ?? "location.href");
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  page.close();
}
