// @effect-diagnostics nodeBuiltinImport:off - Plain async over child processes: macOS' avconvert and, when installed, ffmpeg.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

// A copy a phone streams: avconvert (built into macOS) makes H.264 at most 1920 on its long edge,
// HDR turned to SDR correctly, fast-start, without location metadata. ffmpeg, when installed,
// then squeezes that to about 5 Mbps at no more than 30 fps; it only ever reads avconvert's SDR
// output, since on an HDR source it tags 8-bit output as HLG.

const AVCONVERT = "/usr/bin/avconvert";
/** A child still running after this is killed, and the video plays as it is. */
const TIMEOUT_MS = 10 * 60_000;
/** ffmpeg's squeeze: about 5 Mbps H.264 at most 1920 on its long edge and 30 fps, fast-start, no metadata. */
const SQUEEZE = [
  "-map 0:v:0 -map 0:a:0?",
  "-vf scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',fps='min(30,source_fps)'",
  "-c:v h264_videotoolbox -b:v 5M -maxrate 6M -bufsize 10M -profile:v high -pix_fmt yuv420p",
  "-c:a aac -b:a 128k -movflags +faststart -map_metadata -1",
]
  .join(" ")
  .split(" ");

/** Writes a small fast-start H.264 copy of `source` to `output` (an `.mp4`). */
export async function encodeForPhones(source: string, output: string): Promise<void> {
  const ffmpeg = await findFfmpeg();
  const sdr =
    ffmpeg === null
      ? output
      : NodePath.join(NodePath.dirname(output), `${NodePath.basename(output, ".mp4")}.sdr.mp4`);
  try {
    await run(AVCONVERT, ["-s", source, "-p", "Preset1920x1080", "-o", sdr, "--replace"]);
    if (ffmpeg === null) return;
    await run(ffmpeg, ["-nostdin", "-v", "error", "-y", "-i", sdr, ...SQUEEZE, output]);
  } finally {
    if (sdr !== output) await NodeFSP.rm(sdr, { force: true });
  }
}

/** ffmpeg on the PATH, else Homebrew's (an app started from the Dock has a short PATH). */
async function findFfmpeg(): Promise<string | null> {
  const dirs = (process.env.PATH ?? "").split(NodePath.delimiter).filter(NodePath.isAbsolute);
  for (const dir of [...dirs, "/opt/homebrew/bin", "/usr/local/bin"]) {
    const candidate = NodePath.join(dir, "ffmpeg");
    const found = await NodeFSP.access(candidate, NodeFS.constants.X_OK).then(
      () => true,
      () => false,
    );
    if (found) return candidate;
  }
  return null;
}

/** Runs a command at low priority; rejects with the end of its stderr when it fails. */
function run(command: string, args: ReadonlyArray<string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = NodeChildProcess.spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
      timeout: TIMEOUT_MS,
      killSignal: "SIGKILL",
    });
    if (child.pid !== undefined) {
      try {
        NodeOS.setPriority(child.pid, 10);
      } catch {
        // It may have exited already; it runs at normal priority otherwise.
      }
    }
    let tail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      tail = (tail + chunk.toString()).slice(-2000);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else {
        const how = signal === null ? `exited with ${code}` : `was killed (${signal})`;
        reject(new Error(`${NodePath.basename(command)} ${how}: ${tail.trim()}`));
      }
    });
  });
}
