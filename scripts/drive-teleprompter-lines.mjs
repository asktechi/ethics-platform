import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv();

const runId = process.argv[2];
const dogIndex = Number(process.argv[3] ?? 15);
const delayMs = Number(process.argv[4] ?? 10000);
if (!runId) throw new Error("usage: drive-teleprompter-lines.mjs <runId> [dogIndex] [delayMs]");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const host = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const channel = host.channel(`presentation:${runId}`, { config: { broadcast: { self: false } } });

await new Promise((resolve, reject) => {
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") resolve();
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
  });
});

const send = async (type, slideIndex, extra = {}) => {
  const payload = { type, slideIndex, ts: Date.now(), ...extra };
  const result = await channel.send({ type: "broadcast", event: "state", payload });
  console.log(JSON.stringify({ sent: result, payload }));
  return result;
};

console.log(JSON.stringify({ waiting_ms: delayMs, dogIndex }));
await sleep(delayMs);
await send("GOTO", dogIndex, { lineIndex: -1 });
await sleep(3000);
await send("TELEPROMPTER_LINE", dogIndex, { lineIndex: 0 });
await sleep(4000);
await send("TELEPROMPTER_LINE", dogIndex, { lineIndex: 1 });
await sleep(4000);
await send("PAUSE", dogIndex, { lineIndex: 1, isPaused: true });
await sleep(5000);
await send("TELEPROMPTER_LINE", dogIndex, { lineIndex: 2 });
await sleep(2000);
await send("RESUME", dogIndex, { lineIndex: 1, isPaused: false });
await sleep(1500);
await send("TELEPROMPTER_LINE", dogIndex, { lineIndex: 2 });
await sleep(4000);
await send("NEXT", dogIndex + 1, { revealAll: true });
await host.removeChannel(channel);
console.log(JSON.stringify({ done: true }));
