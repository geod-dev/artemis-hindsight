import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ExecResult } from "@artemis/contracts";

const MAX_OUTPUT_BYTES = 64 * 1024; // per stream

export interface ExecOptions {
  dataRoot: string;
  sessionId: string;
  command: string;
  timeoutMs: number;
}

/**
 * Runs `command` with bash inside the session folder, <dataRoot>/sessions/<sessionId>.
 * Files persist across commands of the same conversation. The whole process group
 * is killed on timeout so background children cannot outlive the call.
 */
export async function runCommand(opts: ExecOptions): Promise<ExecResult> {
  const cwd = path.join(opts.dataRoot, "sessions", opts.sessionId);
  await mkdir(cwd, { recursive: true });

  const started = Date.now();

  return new Promise<ExecResult>((resolve) => {
    const child = spawn("bash", ["-c", opts.command], {
      cwd,
      detached: true, // own process group, so we can kill the whole tree
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
        HOME: cwd,
        LANG: "C.UTF-8",
        TERM: "dumb",
      },
    });

    const out = new CappedBuffer(MAX_OUTPUT_BYTES);
    const err = new CappedBuffer(MAX_OUTPUT_BYTES);
    let timedOut = false;

    child.stdout.on("data", (chunk: Buffer) => out.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => err.push(chunk));

    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // process group already gone
        }
      }
    }, opts.timeoutMs);

    const finish = (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({
        stdout: out.toString(),
        stderr: err.toString(),
        exitCode,
        timedOut,
        truncated: out.truncated || err.truncated,
        durationMs: Date.now() - started,
      });
    };

    child.on("error", (error) => {
      err.push(Buffer.from(`sandbox: failed to start bash: ${error.message}\n`));
      finish(null);
    });
    child.on("close", (code) => finish(code));
  });
}

class CappedBuffer {
  private chunks: Buffer[] = [];
  private size = 0;
  truncated = false;

  constructor(private readonly limit: number) {}

  push(chunk: Buffer): void {
    const remaining = this.limit - this.size;
    if (remaining <= 0) {
      this.truncated = true;
      return;
    }
    if (chunk.length > remaining) {
      this.chunks.push(chunk.subarray(0, remaining));
      this.size += remaining;
      this.truncated = true;
      return;
    }
    this.chunks.push(chunk);
    this.size += chunk.length;
  }

  toString(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}
