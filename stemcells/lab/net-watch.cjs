// What a lab's Node processes ask of the network, written down and held on
// the machine.
//
// stemcells/lab/outbound-live preloads it, beside never-shown.cjs, into every
// Node process the lab starts: Electron's main, the server Electron runs as
// Node, and any Node child after them (NODE_OPTIONS carries it down). With
// STEMCELLS_NET_LOG naming a file, each process appends one JSON line there
// for every name it looks up and every socket it opens, and anything bound
// beyond loopback fails as an offline Mac would fail it: the lookup finds
// nothing, the connection is refused. So the run sees every contact the app
// would make, and none of them leaves.
//
// Chromium's own traffic (the pages, Electron's `net`, the updater) goes
// through its network service, not Node's: outbound-live reads that from
// Chromium's net log instead.
"use strict";

const NodeFS = require("node:fs");
const NodeNet = require("node:net");

/** A name or address that stays on this machine. */
function isLoopback(host) {
  if (host === undefined || host === null || host === "") return true; // Node's default: localhost
  const name = String(host)
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (name === "localhost" || name.endsWith(".localhost")) return true;
  if (name === "::1" || name === "::" || name === "0.0.0.0" || name === "0:0:0:0:0:0:0:1")
    return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(name)) return true;
  // An IPv4 loopback written as IPv6.
  if (/^::ffff:127(?:\.\d{1,3}){3}$/.test(name)) return true;
  return false;
}

/** The host and port a `Socket#connect` call is for, or null for a local path (IPC). */
function connectTarget(args) {
  let first = args[0];
  // net.connect() hands the socket its normalized [options, callback].
  if (Array.isArray(first)) first = first[0];
  if (first !== null && typeof first === "object") {
    if (first.path !== undefined && first.path !== null) return null;
    return { host: first.host ?? "localhost", port: first.port };
  }
  if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    return { host: typeof args[1] === "string" ? args[1] : "localhost", port: Number(first) };
  }
  return null;
}

module.exports = { isLoopback, connectTarget };

const log = process.env.STEMCELLS_NET_LOG;
if (log && !globalThis[Symbol.for("stemcells.netWatch")]) {
  globalThis[Symbol.for("stemcells.netWatch")] = true;
  install(log);
  if (
    process.versions.electron &&
    process.type === "browser" &&
    process.env.STEMCELLS_CHROMIUM_NET_LOG
  ) {
    chromiumNetLog(process.env.STEMCELLS_CHROMIUM_NET_LOG);
  }
}

/**
 * Chromium's own net log, through Electron's API, from ready until the app
 * quits (Electron ends it then). Electron's module can be had once the
 * app's main has run, not while NODE_OPTIONS preloads this.
 */
function chromiumNetLog(file) {
  setImmediate(() => {
    const { app, netLog } = require("electron");
    app.whenReady().then(() => netLog.startLogging(file, { captureMode: "default" }));
  });
}

function install(file) {
  const NodeDns = require("node:dns");
  const NodeDgram = require("node:dgram");
  const who = [
    process.versions.electron ? (process.type ?? "electron-as-node") : "node",
    process.argv[1] ? String(process.argv[1]).split("/").slice(-3).join("/") : "",
  ]
    .filter(Boolean)
    .join(" ");

  const record = (kind, host, port, url) => {
    try {
      NodeFS.appendFileSync(
        file,
        `${JSON.stringify({ at: Date.now(), pid: process.pid, who, kind, host: String(host), port, url })}\n`,
      );
    } catch {
      // The log's folder went with the lab: nothing left to write to.
    }
  };
  const failure = (code, syscall, host, port) =>
    Object.assign(
      new Error(
        `${syscall} ${code} ${host}${port === undefined ? "" : `:${port}`} (stemcells lab: held on the machine)`,
      ),
      {
        code,
        errno: code === "ENOTFOUND" ? -3008 : -61,
        syscall,
        hostname: host,
        address: host,
        port,
      },
    );

  // One line as it starts, so a run can tell the watch took in this process.
  record("watch", "");

  // Names, as getaddrinfo looks them up (every socket to a name goes here).
  const lookup = NodeDns.lookup;
  NodeDns.lookup = function stemcellsLabLookup(hostname, options, callback) {
    const done = typeof options === "function" ? options : callback;
    if (isLoopback(hostname)) return lookup.apply(this, arguments);
    record("lookup", hostname);
    process.nextTick(done, failure("ENOTFOUND", "getaddrinfo", hostname));
    return {};
  };
  const promises = NodeDns.promises;
  const lookupPromise = promises.lookup;
  promises.lookup = async function stemcellsLabLookup(hostname, options) {
    if (isLoopback(hostname)) return lookupPromise.call(this, hostname, options);
    record("lookup", hostname);
    throw failure("ENOTFOUND", "getaddrinfo", hostname);
  };

  // Names asked of a DNS server directly (c-ares), on the module and on resolvers.
  const RESOLVE = [
    "resolve",
    "resolve4",
    "resolve6",
    "resolveAny",
    "resolveCaa",
    "resolveCname",
    "resolveMx",
    "resolveNaptr",
    "resolveNs",
    "resolvePtr",
    "resolveSoa",
    "resolveSrv",
    "resolveTlsa",
    "resolveTxt",
    "reverse",
  ];
  const holdResolves = (target, async) => {
    for (const name of RESOLVE) {
      const original = target[name];
      if (typeof original !== "function") continue;
      target[name] = async
        ? async function stemcellsLabResolve(hostname) {
            if (isLoopback(hostname)) return original.apply(this, arguments);
            record("resolve", hostname);
            throw failure("ENOTFOUND", "queryA", hostname);
          }
        : function stemcellsLabResolve(hostname, ...rest) {
            if (isLoopback(hostname)) return original.apply(this, arguments);
            record("resolve", hostname);
            const done = rest.findLast((arg) => typeof arg === "function");
            if (done) process.nextTick(done, failure("ENOTFOUND", "queryA", hostname));
            return {};
          };
    }
  };
  holdResolves(NodeDns, false);
  holdResolves(NodeDns.Resolver.prototype, false);
  holdResolves(promises, true);
  holdResolves(promises.Resolver.prototype, true);

  // fetch, whose sockets open away from the code that asked: the URL says
  // what asked (origin and path; a query may carry a secret). The socket
  // below is still what's refused.
  const fetch = globalThis.fetch;
  if (typeof fetch === "function") {
    globalThis.fetch = function stemcellsLabFetch(input, init) {
      try {
        const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        if (!isLoopback(url.hostname))
          record("fetch", url.hostname, undefined, `${url.origin}${url.pathname}`);
      } catch {
        // Not a URL fetch can reach: it fails on its own.
      }
      return fetch.call(this, input, init);
    };
  }

  // Sockets: TCP and TLS both connect here, to a name or an address.
  const connect = NodeNet.Socket.prototype.connect;
  NodeNet.Socket.prototype.connect = function stemcellsLabConnect(...args) {
    const target = connectTarget(args);
    if (target === null || isLoopback(target.host)) return connect.apply(this, args);
    record("connect", target.host, target.port);
    const error = failure("ECONNREFUSED", "connect", target.host, target.port);
    process.nextTick(() => this.destroy(error));
    return this;
  };

  // UDP: a datagram to anywhere but loopback is dropped.
  const send = NodeDgram.Socket.prototype.send;
  NodeDgram.Socket.prototype.send = function stemcellsLabSend(...args) {
    let host;
    try {
      host = this.remoteAddress().address;
    } catch {
      host = args.slice(1).find((arg) => typeof arg === "string");
    }
    if (isLoopback(host)) return send.apply(this, args);
    record("udp", host);
    const done = args.findLast((arg) => typeof arg === "function");
    if (done) process.nextTick(done, failure("ECONNREFUSED", "send", host));
  };
  const udpConnect = NodeDgram.Socket.prototype.connect;
  NodeDgram.Socket.prototype.connect = function stemcellsLabUdpConnect(port, address) {
    const host = typeof address === "string" ? address : "localhost";
    if (isLoopback(host)) return udpConnect.apply(this, arguments);
    record("udp", host, port);
    process.nextTick(() => this.emit("error", failure("ECONNREFUSED", "connect", host, port)));
  };
}
