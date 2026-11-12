import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { DEFAULT_BOTS, DEFAULT_SETTINGS } from "../src/lib/types";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
  throw new Error("Integration tests only run on local Supabase.");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const password = "Local-test-" + crypto.randomUUID();
const ids: string[] = [];
async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  assert.ifError(error);
  return data;
}
async function room(user: string, settings = {}) {
  const { data, error } = await admin
    .from("rooms")
    .insert({
      user_id: user,
      title: "Integration test",
      topic: "Test turn orchestration",
      purpose: "plan",
      bots: DEFAULT_BOTS,
      settings: { ...DEFAULT_SETTINGS, cooldownSeconds: 1, ...settings },
    })
    .select()
    .single();
  assert.ifError(error);
  return data;
}
async function start(id: string, user: string) {
  return rpc("room_action", { p_room: id, p_user: user, p_action: "start" });
}
const quotes = Object.fromEntries(DEFAULT_BOTS.map((b) => [b.model, 0.01]));
async function claim(
  r: { id: string; run_id: string },
  user: string,
  prices = quotes,
) {
  return rpc("claim_turn", {
    p_room: r.id,
    p_user: user,
    p_run: r.run_id,
    p_prices: prices,
    p_daily_budget: 10,
  });
}
async function finish(m: { id: string; room_id: string }, cost = 0.001) {
  return rpc("finish_turn", {
    p_room: m.room_id,
    p_message: m.id,
    p_content: "Useful response",
    p_cost: cost,
    p_input: 10,
    p_output: 10,
  });
}
try {
  const clients = [];
  for (let i = 0; i < 2; i++) {
    const email = `botsbots-test-${crypto.randomUUID()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(error);
    ids.push(data.user!.id);
    const c = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false } },
    );
    assert.ifError(
      (await c.auth.signInWithPassword({ email, password })).error,
    );
    clients.push(c);
  }
  const user = ids[0];
  let r = await start((await room(user)).id, user);
  let claims = await Promise.all(
    Array.from({ length: 12 }, () => claim(r, user)),
  );
  assert.equal(
    claims.filter(Boolean).length,
    1,
    "Moderated mode must admit one reply under contention",
  );
  const first = claims.find(Boolean);
  await rpc("finish_turn", {
    p_room: first.room_id,
    p_message: first.id,
    p_content: "A reply cut off mid",
    p_cost: 0.001,
    p_input: 10,
    p_output: 450,
    p_finish_reason: "length",
    p_reasoning_tokens: 300,
  });
  const { data: limitedReply, error: limitedError } = await admin
    .from("messages")
    .select("*")
    .eq("id", first.id)
    .single();
  assert.ifError(limitedError);
  assert.equal(limitedReply.finish_reason, "length");
  assert.equal(limitedReply.reasoning_tokens, 300);
  assert.equal(limitedReply.content, "A reply cut off mid");
  assert.equal(limitedReply.cost, 0.001);
  assert.equal(await finish(first), false, "Settlement must be idempotent");
  const second = await claim(r, user);
  assert.notEqual(second.bot_id, first.bot_id);
  await finish(second);
  const third = await claim(r, user);
  await finish(third);
  assert.equal(await claim(r, user), null);
  assert.equal(
    (await admin.from("rooms").select("status").eq("id", r.id).single()).data!
      .status,
    "paused",
  );
  console.log(
    "PASS moderated serialization, unique participants, round pause, idempotent settlement",
  );
  const sendMessage = (id: string, requestId = crypto.randomUUID()) =>
    rpc("room_action", {
      p_room: id,
      p_user: user,
      p_action: "message",
      p_payload: { content: "Consider another perspective", requestId },
    });
  const previousRun = r.run_id;
  // Advance the completed round past its per-bot cooldown without a timed test wait.
  assert.ifError(
    (
      await admin
        .from("messages")
        .update({ completed_at: new Date(Date.now() - 2000).toISOString() })
        .eq("room_id", r.id)
        .eq("run_id", previousRun)
    ).error,
  );
  const resumeRequest = crypto.randomUUID();
  const resumed = await Promise.all(
    Array.from({ length: 8 }, () => sendMessage(r.id, resumeRequest)),
  );
  r = resumed[0];
  assert.equal(r.status, "running", "Sending resumes a completed round");
  assert.notEqual(r.run_id, previousRun);
  assert.ok(resumed.every((result) => result.run_id === r.run_id));
  assert.equal(
    (await sendMessage(r.id)).run_id,
    r.run_id,
    "Active sends keep the run",
  );
  for (let i = 0; i < DEFAULT_BOTS.length; i++) {
    const reply = await claim(r, user);
    assert.ok(reply, "Each bot gets a turn after auto-resume");
    await finish(reply);
  }
  assert.equal(await claim(r, user), null);
  assert.equal(
    (await sendMessage(r.id, resumeRequest)).status,
    "paused",
    "Retrying a delivered message cannot start another round",
  );
  const fresh = await room(user);
  r = await sendMessage(fresh.id);
  assert.equal(
    r.status,
    "running",
    "The first human message starts an idle room",
  );
  const blockedRoom = await room(user);
  const blockedSend = await admin.rpc("room_action", {
    p_room: blockedRoom.id,
    p_user: user,
    p_action: "message",
    p_payload: {
      content: "Cannot run a second room",
      requestId: crypto.randomUUID(),
    },
  });
  assert.ok(blockedSend.error, "Another active room blocks auto-resume");
  assert.equal(
    (await admin.from("messages").select("id").eq("room_id", blockedRoom.id))
      .data!.length,
    0,
    "Failed auto-resume rolls back the send",
  );
  const pendingReply = await claim(r, user);
  await rpc("room_action", { p_room: r.id, p_user: user, p_action: "pause" });
  const pendingSend = await admin.rpc("room_action", {
    p_room: r.id,
    p_user: user,
    p_action: "message",
    p_payload: {
      content: "Wait for pending work",
      requestId: crypto.randomUUID(),
    },
  });
  assert.ok(pendingSend.error, "Paused in-flight work still fences a new run");
  await finish(pendingReply);
  await rpc("room_action", { p_room: r.id, p_user: user, p_action: "stop" });
  const stoppedSend = await admin.rpc("room_action", {
    p_room: r.id,
    p_user: user,
    p_action: "message",
    p_payload: {
      content: "Cannot restart an ended room",
      requestId: crypto.randomUUID(),
    },
  });
  assert.ok(stoppedSend.error);
  const tightBudget = await room(user, { budget: 0.001 });
  const budgetRun = await sendMessage(tightBudget.id);
  assert.equal(
    await claim(budgetRun, user),
    null,
    "Auto-resume preserves the budget cap",
  );
  const capped = await room(user, { maxMessages: 1 });
  const cappedRun = await sendMessage(capped.id);
  assert.equal(
    await claim(cappedRun, user),
    null,
    "Human sends still consume the total quota",
  );
  console.log(
    "PASS atomic send-and-resume, duplicate retries, active runs, start guards, budgets and quotas",
  );
  const { data: privateRooms } = await clients[1].from("rooms").select("*");
  assert.equal(privateRooms!.length, 0);
  assert.ok(
    (
      await clients[0].rpc("claim_turn", {
        p_room: r.id,
        p_user: user,
        p_run: r.run_id,
        p_prices: quotes,
        p_daily_budget: 10,
      })
    ).error,
  );
  assert.ok(
    (
      await clients[0]
        .from("rooms")
        .update({ status: "running" })
        .eq("id", r.id)
    ).error,
  );
  assert.ok(
    (
      await admin.rpc("room_action", {
        p_room: r.id,
        p_user: ids[1],
        p_action: "start",
      })
    ).error,
  );
  console.log(
    "PASS RLS isolation, server-only writes, RPC access, owner check",
  );
  r = await start(
    (
      await room(user, {
        mode: "free",
        concurrency: 2,
        maxMessages: 4,
        maxPerBot: 1,
      })
    ).id,
    user,
  );
  claims = await Promise.all(Array.from({ length: 12 }, () => claim(r, user)));
  assert.equal(claims.filter(Boolean).length, 2);
  assert.equal(new Set(claims.filter(Boolean).map((c) => c.bot_id)).size, 2);
  const requestId = crypto.randomUUID();
  await Promise.all(
    Array.from({ length: 8 }, () =>
      rpc("room_action", {
        p_room: r.id,
        p_user: user,
        p_action: "message",
        p_payload: { content: "Human steering", requestId },
      }),
    ),
  );
  assert.equal(
    (
      await admin
        .from("messages")
        .select("id")
        .eq("room_id", r.id)
        .is("bot_id", null)
    ).data!.length,
    1,
  );
  await Promise.all(claims.filter(Boolean).map((c) => finish(c)));
  const last = await claim(r, user);
  assert.ok(last);
  await finish(last);
  assert.equal(await claim(r, user), null);
  assert.equal(
    (await admin.from("messages").select("id").eq("room_id", r.id)).data!
      .length,
    4,
  );
  console.log(
    "PASS free-for-all concurrency, per-bot lock, human idempotency, total cap",
  );
  r = await start(
    (await room(user, { mode: "free", concurrency: 3, budget: 0.015 })).id,
    user,
  );
  claims = await Promise.all(Array.from({ length: 8 }, () => claim(r, user)));
  assert.equal(claims.filter(Boolean).length, 1);
  await rpc("room_action", { p_room: r.id, p_user: user, p_action: "pause" });
  assert.equal(await claim(r, user), null);
  assert.ok(
    (
      await admin.rpc("room_action", {
        p_room: r.id,
        p_user: user,
        p_action: "start",
      })
    ).error,
    "Cannot resume with pending work",
  );
  await finish(claims.find(Boolean), 0.01);
  r = await start(r.id, user);
  assert.equal(await claim(r, user), null);
  console.log("PASS atomic budget reservation, pause, pending-run fencing");
  r = await start((await room(user)).id, user);
  const lost = await claim(r, user);
  await admin
    .from("messages")
    .update({ created_at: new Date(Date.now() - 130000).toISOString() })
    .eq("id", lost.id);
  assert.equal(await claim(r, user), null);
  assert.equal(await finish(lost), false);
  const stale = (
    await admin.from("messages").select("*").eq("id", lost.id).single()
  ).data!;
  assert.equal(stale.status, "failed");
  assert.equal(stale.cost, null);
  assert.equal(stale.reserved_cost, 0.01);
  console.log(
    "PASS stale lease recovery, late-write fencing, retained uncertain cost",
  );
  r = await start((await room(user, { maxPerBot: 1 })).id, user);
  for (let i = 0; i < DEFAULT_BOTS.length; i++)
    await finish(await claim(r, user));
  assert.equal(await claim(r, user), null);
  assert.equal(
    (await admin.from("rooms").select("reason").eq("id", r.id).single()).data!
      .reason,
    "Every bot has reached its reply limit.",
  );
  r = await start((await room(user, { maxMinutes: 1 })).id, user);
  await admin
    .from("rooms")
    .update({ run_started_at: new Date(Date.now() - 65000).toISOString() })
    .eq("id", r.id);
  assert.equal(await claim(r, user), null);
  assert.equal(
    (await admin.from("rooms").select("reason").eq("id", r.id).single()).data!
      .reason,
    "Session time limit reached.",
  );
  const oldRun = r;
  r = await start(r.id, user);
  assert.notEqual(r.run_id, oldRun.run_id);
  assert.equal(
    await claim(oldRun, user),
    null,
    "Old run cannot claim after restart",
  );
  await rpc("room_action", { p_room: r.id, p_user: user, p_action: "pause" });
  const dailyUser = ids[1];
  r = await start(
    (await room(dailyUser, { mode: "free", concurrency: 3 })).id,
    dailyUser,
  );
  claims = await Promise.all(
    Array.from({ length: 8 }, () =>
      rpc("claim_turn", {
        p_room: r.id,
        p_user: dailyUser,
        p_run: r.run_id,
        p_prices: quotes,
        p_daily_budget: 0.015,
      }),
    ),
  );
  assert.equal(
    claims.filter(Boolean).length,
    1,
    "Daily reservations serialize under contention",
  );
  await finish(claims.find(Boolean), 0.01);
  assert.equal(
    await rpc("claim_turn", {
      p_room: r.id,
      p_user: dailyUser,
      p_run: r.run_id,
      p_prices: quotes,
      p_daily_budget: 0.015,
    }),
    null,
  );
  assert.equal(
    (await admin.from("rooms").select("reason").eq("id", r.id).single()).data!
      .reason,
    "Daily account budget reached.",
  );
  console.log(
    "PASS per-bot quota, session duration, old-run fencing, atomic daily budget",
  );
  const summaryRoom = await room(user, { budget: 0.015 });
  const { data: source, error: sourceError } = await admin
    .from("messages")
    .insert({
      room_id: summaryRoom.id,
      bot_id: DEFAULT_BOTS[0].id,
      speaker: "Planner",
      model: DEFAULT_BOTS[0].model,
      content: "Try the smallest useful experiment.",
    })
    .select()
    .single();
  assert.ifError(sourceError);
  const summaryArgs = {
    p_room: summaryRoom.id,
    p_user: user,
    p_request: crypto.randomUUID(),
    p_model: DEFAULT_BOTS[1].model,
    p_source_ids: [source.id],
    p_quote: 0.01,
    p_daily_budget: 10,
  };
  const summaryClaims = await Promise.all(
    Array.from({ length: 8 }, () => rpc("claim_summary", summaryArgs)),
  );
  assert.equal(
    summaryClaims.filter((s) => s.claimed).length,
    1,
    "Repeated manual request must only claim once",
  );
  const summary = summaryClaims[0].summary;
  assert.equal(summary.source_count, 1);
  assert.deepEqual(summary.source_ids, [source.id]);
  assert.ok(
    (
      await admin.rpc("claim_summary", {
        ...summaryArgs,
        p_request: crypto.randomUUID(),
      })
    ).error,
    "Only one pending summary per room",
  );
  assert.ok(
    (await clients[0].rpc("claim_summary", summaryArgs)).error,
    "Only server can reserve summaries",
  );
  assert.equal(
    (
      await clients[1]
        .from("summaries")
        .select("*")
        .eq("room_id", summaryRoom.id)
    ).data!.length,
    0,
    "Other users cannot read summary",
  );
  assert.ok(
    (await admin.rpc("claim_summary", { ...summaryArgs, p_user: ids[1] }))
      .error,
    "Owner check before idempotency lookup",
  );
  r = await start(summaryRoom.id, user);
  assert.equal(
    await claim(r, user),
    null,
    "Pending summary reserves budget against bot calls",
  );
  assert.equal(
    (await admin.from("messages").select("id").eq("room_id", r.id)).data!
      .length,
    1,
    "Summaries do not create bot turns",
  );
  const settlement = {
    p_summary: summary.id,
    p_content: "Planner proposes a small experiment.",
    p_cost: 0.01,
    p_finish_reason: "stop",
  };
  assert.equal(await rpc("finish_summary", settlement), true);
  assert.equal(await rpc("finish_summary", settlement), false);
  assert.ok(
    (
      await admin.rpc("claim_summary", {
        ...summaryArgs,
        p_request: crypto.randomUUID(),
      })
    ).error,
    "Summary cannot exceed remaining room budget",
  );
  const nextRoom = await room(user);
  const { data: nextSource } = await admin
    .from("messages")
    .insert({
      room_id: nextRoom.id,
      bot_id: DEFAULT_BOTS[0].id,
      speaker: "Planner",
      content: "Next experiment",
    })
    .select()
    .single();
  const nextArgs = {
    ...summaryArgs,
    p_room: nextRoom.id,
    p_request: crypto.randomUUID(),
    p_source_ids: [nextSource.id],
  };
  assert.ok(
    (await admin.rpc("claim_summary", { ...nextArgs, p_daily_budget: 0.005 }))
      .error,
    "Daily spending includes summaries",
  );
  const lostSummary = (await rpc("claim_summary", nextArgs)).summary;
  await admin
    .from("summaries")
    .update({ created_at: new Date(Date.now() - 130000).toISOString() })
    .eq("id", lostSummary.id);
  const retry = await rpc("claim_summary", {
    ...nextArgs,
    p_request: crypto.randomUUID(),
  });
  assert.equal(
    retry.claimed,
    true,
    "Only a new manual request recovers stale work",
  );
  assert.equal(
    await rpc("finish_summary", { ...settlement, p_summary: lostSummary.id }),
    false,
    "Late summary cannot overwrite recovered failure",
  );
  const { data: lostRecord } = await admin
    .from("summaries")
    .select("*")
    .eq("id", lostSummary.id)
    .single();
  assert.equal(lostRecord.status, "failed");
  assert.equal(lostRecord.cost, null);
  assert.equal(lostRecord.reserved_cost, 0.01);
  await rpc("finish_summary", { ...settlement, p_summary: retry.summary.id });
  console.log(
    "PASS summary snapshots, idempotency, permissions, shared budgets, stale work, separate quotas",
  );
  console.log("All integration checks passed. No Gateway calls were made.");
} finally {
  for (const id of ids)
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
}
