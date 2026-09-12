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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase public env");

function waitFor(channel, eventName, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), timeoutMs);
    channel.on("broadcast", { event: eventName }, ({ payload }) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

const host = createClient(url, key, { auth: { persistSession: false } });
const audience = createClient(url, key, { auth: { persistSession: false } });
const runId = process.argv[2] ?? "00000000-0000-0000-0000-000000000001";
const name = `presentation:${runId}`;

const hostCh = host.channel(name, { config: { broadcast: { self: false } } });
const audCh = audience.channel(name, { config: { broadcast: { self: false } } });

const received = waitFor(audCh, "state");

await new Promise((resolve, reject) => {
  let remaining = 2;
  const done = (status, who) => {
    if (status === "SUBSCRIBED") {
      remaining -= 1;
      if (remaining === 0) resolve();
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      reject(new Error(`${who} ${status}`));
    }
  };
  hostCh.subscribe((status) => done(status, "host"));
  audCh.subscribe((status) => done(status, "audience"));
});

const sentAt = Date.now();
const send = await hostCh.send({
  type: "broadcast",
  event: "state",
  payload: { type: "NEXT", slideIndex: 1, ts: sentAt },
});
if (send !== "ok") throw new Error(`Host broadcast failed: ${send}`);

const payload = await received;
const latency = Date.now() - sentAt;

await host.removeChannel(hostCh);
await audience.removeChannel(audCh);

if (payload?.type !== "NEXT" || payload?.slideIndex !== 1) {
  throw new Error(`Unexpected payload ${JSON.stringify(payload)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      channel: name,
      latency_ms: latency,
      payload,
    },
    null,
    2,
  ),
);
