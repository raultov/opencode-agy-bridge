import type { SpawnOptions } from "node:child_process";
import { spawn } from "node:child_process";

export interface RunAgyInput {
  prompt: string;
  cwd: string;
  conversationId?: string;
  binary?: string;
  extraArgs?: string[];
  timeoutMs?: number;
}

export interface RunAgyResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runAgy(input: RunAgyInput): Promise<RunAgyResult> {
  const binary = input.binary ?? "agy";
  const timeoutMs = input.timeoutMs ?? 300_000;
  const extraArgs = input.extraArgs ?? [];

  const args: string[] = [
    "--add-dir",
    input.cwd,
    ...extraArgs,
  ];

  if (input.conversationId) {
    args.push("--conversation", input.conversationId);
  }

  args.push("-p", "-");

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    child.stdin.write(input.prompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("agy timed out"));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);

      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      const exitCode = code ?? 1;

      if (stderr.trim()) {
        console.error("[agy-bridge] agy stderr:", stderr.trimEnd());
      }

      if (exitCode !== 0 && !stdout.trim()) {
        const msg = stderr.trim() || `agy exited with status ${exitCode}`;
        reject(new Error(msg));
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`failed to spawn agy: ${err.message}`));
    });
  });
}
