// Lab rig: in the lab app's main process only, serves POST /post on 127.0.0.1 and hands the
// stream to the addon, which posts it into the app's own event queue.
if (process.versions.electron && process.type === "browser") {
  const http = require("node:http");
  const fs = require("node:fs");
  const path = require("node:path");
  // The newest build of the addon, so a rebuilt one loads without restarting the app.
  const newest = () => {
    const builds = fs.readdirSync(__dirname).filter((name) => /^inject.*\.node$/.test(name));
    builds.sort(
      (a, b) =>
        fs.statSync(path.join(__dirname, b)).mtimeMs - fs.statSync(path.join(__dirname, a)).mtimeMs,
    );
    return require(path.join(__dirname, builds[0]));
  };
  let serial = 0;
  http
    .createServer((request, response) => {
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        const file = path.join(__dirname, `stream-${process.pid}-${serial++}.txt`);
        fs.writeFileSync(file, body);
        newest().post(file);
        const wait = setInterval(() => {
          if (!fs.existsSync(`${file}.out`)) return;
          clearInterval(wait);
          response.end(fs.readFileSync(`${file}.out`, "utf8"));
          fs.rmSync(file, { force: true });
          fs.rmSync(`${file}.out`, { force: true });
        }, 20);
      });
    })
    .listen(Number(process.env.LAB_INJECT_PORT ?? 9378), "127.0.0.1");
}
