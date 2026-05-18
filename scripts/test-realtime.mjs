// Diagnostic: subscribe to chat_messages INSERTs and report status.
// Run from project root:  node scripts/test-realtime.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env.local manually (avoid extra deps).
const envRaw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = Object.fromEntries(
  envRaw
    .split("\n")
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const idx = l.indexOf("=");
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

console.log("→ Supabase URL:", URL_);
console.log("→ Using anon key:", KEY.slice(0, 24) + "...");

const supabase = createClient(URL_, KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

const channel = supabase
  .channel("test-chat-diag")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "chat_messages" },
    (payload) => {
      console.log("✓ INSERT received:", {
        text: payload.new.text,
        member_id: payload.new.member_id,
        is_admin_reply: payload.new.is_admin_reply,
      });
    }
  )
  .subscribe((status, err) => {
    console.log(`→ Status: ${status}`);
    if (err) console.error("  Error:", err);
    if (status === "SUBSCRIBED") {
      console.log("\nListening... Insert a row in chat_messages now (or send a message in the app).");
      console.log("Press Ctrl+C to exit.\n");
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      console.error("\nSubscription did not establish properly.");
      console.error("Likely causes:");
      console.error("  - Publication 'supabase_realtime' does not include chat_messages");
      console.error("  - RLS policies are blocking SELECT for the anon role");
      console.error("  - Realtime is disabled at the project level");
      process.exit(1);
    }
  });

// Keep alive
setInterval(() => {}, 60000);
