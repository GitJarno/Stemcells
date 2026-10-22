// @effect-diagnostics nodeBuiltinImport:off - runs Node children with the lab's network hook.
/**
 * The runtime half of a sync's outbound gate (outbound-live.mjs) sees every
 * contact the running app makes, and lets none of them leave: a Node
 * process's lookups and sockets beyond loopback are written down and fail
 * (net-watch.cjs), and Chromium's net log and lsof's sockets are read for
 * the hosts they name. If this fails, a contact could leave a lab run
 * unseen, or leave the machine during it.
 */
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

interface NetWatch {
  isLoopback(host: string | undefined): boolean;
  connectTarget(args: unknown[]): { host: string; port: unknown } | null;
}
interface OutboundLive {
  HELD_NAME: string;
  hostOf(value: string): string | null;
  shownHost(host: string): string;
  netLogHosts(text: string): Array<{ host: string; at?: number }>;
  lsofPeers(text: string): Array<{ host: string; pid: number; command: string }>;
  liveAllowed(text: string): Map<string, string>;
  allowance(allowed: Map<string, string>, host: string, urls: Set<string>): string | null;
  unseenLive(allowed: Map<string, string>, seen: Map<string, { urls: Set<string> }>): string[];
}

const hook = NodePath.resolve(import.meta.dirname, "net-watch.cjs");
const netWatch = NodeModule.createRequire(import.meta.url)("./net-watch.cjs") as NetWatch;
const live = (await import("./outbound-live.mjs")) as OutboundLive;

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) NodeFS.rmSync(folder, { recursive: true, force: true });
});

/** Runs `script` in a Node child with the lab's hook, and returns what it printed and what the hook wrote. */
function runWatched(script: string, withLog = true) {
  const folder = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "net-watch-"));
  folders.push(folder);
  const log = NodePath.join(folder, "net.jsonl");
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_OPTIONS: `--require "${hook}"`,
  };
  if (withLog) env.STEMCELLS_NET_LOG = log;
  else delete env.STEMCELLS_NET_LOG;
  const run = NodeChildProcess.spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    env,
  });
  expect(run.stderr).toBe("");
  const lines = NodeFS.existsSync(log)
    ? NodeFS.readFileSync(log, "utf8").split("\n").filter(Boolean)
    : [];
  return {
    printed: JSON.parse(run.stdout) as Record<string, string>,
    contacts: lines.map((line) => JSON.parse(line) as { kind: string; host: string; url?: string }),
  };
}

describe("a lab's Node processes", () => {
  it("write down every contact beyond loopback and send none of it, while loopback works", () => {
    const { printed, contacts } = runWatched(`
      const dns = require("node:dns"), net = require("node:net"), http = require("node:http"), dgram = require("node:dgram");
      (async () => {
        const out = {};
        await fetch("https://t3.example.dev/heartbeat?key=secret").catch((e) => { out.fetch = e.cause?.code; });
        await dns.promises.lookup("feed.example.dev").catch((e) => { out.lookup = e.code; });
        await new Promise((done) => dns.resolve4("dns.example.dev", (e) => { out.resolve = e?.code; done(); }));
        await new Promise((done) => net.connect(443, "192.0.2.1").on("error", (e) => { out.address = e.code; done(); }));
        await new Promise((done) => { const u = dgram.createSocket("udp4"); u.send("x", 53, "192.0.2.2", (e) => { out.udp = e?.code; u.close(); done(); }); });
        const server = http.createServer((_, res) => res.end("here")).listen(0, "127.0.0.1");
        await new Promise((done) => server.on("listening", done));
        out.loopback = await (await fetch("http://localhost:" + server.address().port)).text();
        server.close();
        console.log(JSON.stringify(out));
      })();
    `);
    // fetch also says what asked: the URL, without its query.
    expect(contacts.find(({ kind }) => kind === "fetch")?.url).toBe(
      "https://t3.example.dev/heartbeat",
    );
    expect(printed).toEqual({
      fetch: "ECONNREFUSED",
      lookup: "ENOTFOUND",
      resolve: "ENOTFOUND",
      address: "ECONNREFUSED",
      udp: "ECONNREFUSED",
      loopback: "here",
    });
    // The first line says the watch took in this process; then each contact.
    expect(contacts.map(({ kind, host }) => `${kind} ${host}`)).toEqual([
      "watch ",
      "fetch t3.example.dev",
      "connect t3.example.dev",
      "lookup feed.example.dev",
      "resolve dns.example.dev",
      "connect 192.0.2.1",
      "udp 192.0.2.2",
    ]);
  });

  it("are left alone when no lab asked for a log", () => {
    const { printed, contacts } = runWatched(
      `console.log(JSON.stringify({ lookup: require("node:dns").lookup.name, connect: require("node:net").Socket.prototype.connect.name }))`,
      false,
    );
    expect(printed.lookup).not.toMatch(/stemcellsLab/);
    expect(printed.connect).not.toMatch(/stemcellsLab/);
    expect(contacts).toEqual([]);
  });

  it("count only this machine as loopback", () => {
    const local = [
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "127.8.0.3",
      "::1",
      "[::1]",
      "0.0.0.0",
      "",
    ];
    const away = [
      "t3.codes",
      "10.0.0.2",
      "192.168.1.5",
      "100.100.100.100",
      "::ffff:8.8.8.8",
      "localhost.example.com",
    ];
    expect(local.filter((host) => !netWatch.isLoopback(host))).toEqual([]);
    expect(away.filter((host) => netWatch.isLoopback(host))).toEqual([]);
  });

  it("read the target of each way a socket is connected, and leave a local path alone", () => {
    expect(netWatch.connectTarget([[{ host: "a.example.dev", port: 443 }, () => {}]])).toEqual({
      host: "a.example.dev",
      port: 443,
    });
    expect(netWatch.connectTarget([443, "b.example.dev"])).toEqual({
      host: "b.example.dev",
      port: 443,
    });
    expect(netWatch.connectTarget([{ port: 80 }])).toEqual({ host: "localhost", port: 80 });
    expect(netWatch.connectTarget([{ path: "/tmp/server.sock" }])).toBeNull();
    expect(netWatch.connectTarget(["/tmp/server.sock"])).toBeNull();
  });
});

describe("the records a lab run reads", () => {
  it("find every host in a Chromium net log, even one cut short as the app stopped", () => {
    const netLog = [
      '{"constants": {"logEventTypes": {"REQUEST_ALIVE": 1, "HOST_RESOLVER_MANAGER_REQUEST": 2, "TCP_CONNECT": 3, "UDP_CONNECT": 4, "UDP_BYTES_SENT": 5, "UDP_LOCAL_ADDRESS": 6}, "logSourceType": {"URL_REQUEST": 1, "HOST_RESOLVER_IMPL_JOB": 2, "SOCKET": 3, "UDP_SOCKET": 4}, "timeTickOffset": "1000"},',
      '"events": [',
      '{"params":{"url":"https://ingest.example.dev/batch"},"phase":1,"source":{"id":1,"type":1},"time":"10","type":1},',
      '{"params":{"host":"https://models.example.dev:443"},"phase":1,"source":{"id":2,"type":2},"time":"11","type":2},',
      '{"params":{"address_list":["192.0.2.7:443","[2001:db8::1]:443"]},"phase":0,"source":{"id":3,"type":3},"time":"12","type":3},',
      '{"params":{"url":"http://127.0.0.1:3773/api/state"},"phase":1,"source":{"id":4,"type":1},"time":"13","type":1},',
      '{"params":{"url":"chrome://gpu/","host":"localhost:3773"},"phase":1,"source":{"id":5,"type":1},"time":"14","type":1},',
      '{"params":{"url":"wss://relay.example.dev/socket"},"phase":1,"source":{"id":6,"type":1},"time":"15","type":1},',
      '{"params":{"address":"[2001:4860:4860::8888]:443"},"phase":0,"source":{"id":7,"type":4},"time":"16","type":4},',
      '{"params":{"address":"192.168.1.20:50000"},"phase":0,"source":{"id":7,"type":4},"time":"16","type":6},',
      '{"params":{"address":"192.0.2.53:53"},"phase":0,"source":{"id":8,"type":4},"time":"17","type":4},',
      '{"params":{"byte_count":40},"phase":0,"source":{"id":8,"type":4},"time":"17","type":5},',
      '{"params":{"address":"192.168.1.20:50001"},"phase":0,"source":{"id":8,"type":4},"time":"17","type":6},',
      '{"params":{"url":"https://cut.exam',
    ].join("\n");
    const hosts = live.netLogHosts(netLog);
    // The UDP socket that only connected sent nothing (Chromium's IPv6
    // check); one that sent counts; a socket's own address never does.
    expect(
      [...new Set(hosts.map(({ host }) => host))].filter((host) => !netWatch.isLoopback(host)),
    ).toEqual([
      "ingest.example.dev",
      "models.example.dev",
      "192.0.2.7",
      "2001:db8::1",
      "relay.example.dev",
      "192.0.2.53",
    ]);
    expect(hosts[0]).toMatchObject({ host: "ingest.example.dev", at: 1010 });
  });

  it("report a name the lab's rule held only when no request beside it names the host", () => {
    const constants =
      '{"constants": {"logEventTypes": {"REQUEST_ALIVE": 1, "HOST_RESOLVER_MANAGER_REQUEST": 2}, "logSourceType": {"URL_REQUEST": 1, "NETWORK_QUALITY_ESTIMATOR": 2}, "timeTickOffset": "0"},';
    const held = (time: number) =>
      `{"params":{"host":"https://${live.HELD_NAME}"},"phase":1,"source":{"id":9,"type":2},"time":"${time}","type":2},`;
    const request =
      '{"params":{"url":"https://probe.example.dev/"},"phase":1,"source":{"id":8,"type":1},"time":"100","type":1},';
    const beside = live.netLogHosts([constants, '"events": [', request, held(100)].join("\n"));
    expect(beside.map(({ host }) => host)).toEqual(["probe.example.dev"]);
    const alone = live.netLogHosts([constants, '"events": [', request, held(9_000)].join("\n"));
    expect(alone.map(({ host }) => host)).toEqual(["probe.example.dev", live.HELD_NAME]);
  });

  it("show an address on the person's own network by its kind alone", () => {
    for (const host of [
      "192.168.1.94",
      "10.0.0.2",
      "172.20.10.4",
      "100.100.100.100",
      "169.254.1.1",
    ]) {
      expect(live.shownHost(host)).toBe("an address on a private network (IPv4)");
    }
    for (const host of ["fe80::18c6:1", "fd00::1"]) {
      expect(live.shownHost(host)).toBe("an address on a private network (IPv6)");
    }
    expect(live.shownHost("t3.codes")).toBe("`t3.codes`");
    expect(live.shownHost("172.32.0.1")).toBe("`172.32.0.1`");
  });

  it("find every peer beyond loopback in lsof's sockets, with its process", () => {
    const lsof = [
      "p501",
      "cElectron",
      "f31",
      "n127.0.0.1:50110->127.0.0.1:3773",
      "f32",
      "n*:3773",
      "p502",
      "cElectron Helper",
      "f40",
      "n192.168.1.20:50111->192.0.2.9:443",
      "f41",
      "n[2001:db8::2]:50112->[2001:db8::9]:443",
      "f42",
      "n[::1]:50113->[::1]:3773",
    ].join("\n");
    expect(live.lsofPeers(lsof)).toEqual([
      { host: "192.0.2.9", pid: 502, command: "Electron Helper" },
      { host: "2001:db8::9", pid: 502, command: "Electron Helper" },
    ]);
  });

  it("take a host the running app may contact only from a live line that says why", () => {
    const allowed = live.liveAllowed(
      [
        "host t3.codes legal links",
        "live models.example.dev the bundled list's refresh, until #999 lands",
        "live reasonless.example.dev",
      ].join("\n"),
    );
    expect([...allowed]).toEqual([
      ["models.example.dev", "the bundled list's refresh, until #999 lands"],
    ]);
  });

  it("let a line for one path on a shared host pass that path's fetches and nothing else there", () => {
    const allowed = live.liveAllowed(
      [
        "live prices.example.dev/vendor/table/ the price table, until it is bundled",
        "live feed.example.dev the release feed, until it goes",
      ].join("\n"),
    );
    const table = "https://prices.example.dev/vendor/table/v1.json";
    const other = "https://prices.example.dev/t3/model-list.json";
    expect(live.allowance(allowed, "prices.example.dev", new Set([table]))).toBe(
      "the price table, until it is bundled",
    );
    // T3's file on the same host, beside the listed one, or a socket with no fetch to read.
    expect(live.allowance(allowed, "prices.example.dev", new Set([table, other]))).toBeNull();
    expect(live.allowance(allowed, "prices.example.dev", new Set())).toBeNull();
    expect(live.allowance(allowed, "feed.example.dev", new Set())).toBe(
      "the release feed, until it goes",
    );
    expect(live.allowance(allowed, "else.example.dev", new Set())).toBeNull();
  });

  it("call a live line the run never needed stale, so the list only shrinks", () => {
    const allowed = live.liveAllowed(
      ["live prices.example.dev/vendor/table/ the table", "live feed.example.dev the feed"].join(
        "\n",
      ),
    );
    const seen = new Map([
      ["prices.example.dev", { urls: new Set(["https://prices.example.dev/other.json"]) }],
    ]);
    expect(live.unseenLive(allowed, seen)).toEqual([
      "prices.example.dev/vendor/table/",
      "feed.example.dev",
    ]);
  });

  it("name a host from a URL, a host and port, or an address", () => {
    expect(live.hostOf("https://A.example.dev/x?y")).toBe("a.example.dev");
    expect(live.hostOf("b.example.dev:443")).toBe("b.example.dev");
    expect(live.hostOf("[2001:db8::3]:443")).toBe("2001:db8::3");
    expect(live.hostOf("2001:db8::4")).toBe("2001:db8::4");
    expect(live.hostOf("")).toBeNull();
  });
});
