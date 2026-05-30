#!/usr/bin/env bun
import { runAgy } from "../src/agy-runner";
import { flattenPrompt } from "../src/prompt-mapper";

const prompt = [
  { role: "system" as const, content: "You are a helpful assistant. Answer concisely." },
  { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
];

const flat = flattenPrompt(prompt);
console.log("Sending prompt:\n", flat, "\n---\n");

const result = await runAgy({
  prompt: flat,
  cwd: process.cwd(),
  timeoutMs: 300_000,
});

console.log("exitCode:", result.exitCode);
console.log("stdout:\n", result.stdout);
if (result.stderr.trim()) {
  console.error("stderr:\n", result.stderr);
}
