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
if (!runId) throw new Error("run id required");

const host = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const audience = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const name = `presentation:${runId}`;
const hostCh = host.channel(name, { config: { broadcast: { self: false } } });
const audCh = audience.channel(name, { config: { broadcast: { self: false } } });

const received = [];
audCh.on("broadcast", { event: "state" }, ({ payload }) => {
  received.push({ ...payload, heardAt: Date.now() });
});

await new Promise((resolve, reject) => {
  let left = 2;
  const done = (status, who) => {
    if (status === "SUBSCRIBED") {
      left -= 1;
      if (left === 0) resolve();
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(`${who} ${status}`));
  };
  hostCh.subscribe((status) => done(status, "host"));
  audCh.subscribe((status) => done(status, "audience"));
});

const sentAt = Date.now();
const send = await hostCh.send({
  type: "broadcast",
  event: "state",
  payload: { type: "TELEPROMPTER_LINE", slideIndex: 15, lineIndex: 0, ts: sentAt },
});
if (send !== "ok") throw new Error(`broadcast failed ${send}`);

const deadline = Date.now() + 2500;
while (!received.length && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 20));
}

await host.removeChannel(hostCh);
await audience.removeChannel(audCh);

const first = received[0];
if (!first || first.type !== "TELEPROMPTER_LINE" || first.lineIndex !== 0) {
  throw new Error(`unexpected ${JSON.stringify(received)}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      latency_ms: first.heardAt - sentAt,
      payload: { type: first.type, slideIndex: first.slideIndex, lineIndex: first.lineIndex },
    },
    null,
    2,
  ),
);
