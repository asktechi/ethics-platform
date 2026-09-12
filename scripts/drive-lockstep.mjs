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
const delayMs = Number(process.argv[3] ?? 12000);
if (!runId) throw new Error("usage: drive-lockstep.mjs <runId> [delayMs]");

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

console.log(JSON.stringify({ waiting_ms: delayMs }));
await sleep(delayMs);
await send("SNAPSHOT", 0);
await sleep(4000);
await send("NEXT", 1);
await sleep(3500);
await send("GOTO", 6);
await sleep(3500);
await send("GOTO", 2);
await sleep(4000);
await send("END", 2, { ended: true });
await host.removeChannel(channel);
console.log(JSON.stringify({ done: true }));
