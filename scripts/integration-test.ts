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
    p_weekly_budget: 10,
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
  for (let i = 0; i < 3; i++) {
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
  // Archiving uses the same account/room locks as claiming a paid turn.
  const archiveRoom = await start((await room(user)).id, user);
  const inFlight = await claim(archiveRoom, user);
  assert.ok(inFlight);
  const archive = () =>
    rpc("room_action", {
      p_room: archiveRoom.id,
      p_user: user,
      p_action: "archive",
    });
  const archived = await archive();
  assert.ok(archived.archived_at);
  assert.equal(
    archived.updated_at,
    archiveRoom.updated_at,
    "Archiving preserves chat order",
  );
  assert.equal(archived.status, "paused");
  assert.equal(
    (await archive()).archived_at,
    archived.archived_at,
    "Archive retries are idempotent",
  );
  assert.equal(
    await claim(archiveRoom, user),
    null,
    "Archived rooms cannot claim another reply",
  );
  for (const p_action of ["start", "message", "settings"]) {
    assert.ok(
      (
        await admin.rpc("room_action", {
          p_room: archiveRoom.id,
          p_user: user,
          p_action,
        })
      ).error,
      `${p_action} cannot reactivate an archived chat`,
    );
  }
  assert.ok(
    (
      await admin.rpc("room_action", {
        p_room: archiveRoom.id,
        p_user: ids[1],
        p_action: "restore",
      })
    ).error,
  );
  assert.equal(
    (await clients[1].from("rooms").select("*").eq("id", archiveRoom.id)).data!
      .length,
    0,
  );
  await finish(inFlight);
  const archivedMessages = await admin
    .from("messages")
    .select("*")
    .eq("room_id", archiveRoom.id);
  assert.equal(archivedMessages.data!.length, 1);
  assert.equal(
    archivedMessages.data![0].content,
    "Useful response",
    "In-flight reply is retained",
  );
  assert.equal(
    (
      await clients[0]
        .from("rooms")
        .select("id")
        .is("archived_at", null)
        .eq("id", archiveRoom.id)
    ).data!.length,
    0,
  );
  assert.equal(
    (
      await clients[0]
        .from("rooms")
        .select("id")
        .not("archived_at", "is", null)
        .eq("id", archiveRoom.id)
    ).data!.length,
    1,
  );
  const beforeRestore = await admin
    .from("rooms")
    .select("updated_at")
    .eq("id", archiveRoom.id)
    .single();
  assert.ifError(beforeRestore.error);
  const restored = await rpc("room_action", {
    p_room: archiveRoom.id,
    p_user: user,
    p_action: "restore",
  });
  assert.equal(restored.archived_at, null);
  assert.equal(
    restored.updated_at,
    beforeRestore.data!.updated_at,
    "Restoring preserves chat order",
  );
  assert.equal(restored.status, "paused", "Restore never starts generation");
  assert.deepEqual(restored.settings, archiveRoom.settings);
  await rpc("room_action", {
    p_room: archiveRoom.id,
    p_user: user,
    p_action: "stop",
  });
  await archive();
  const endedRestored = await rpc("room_action", {
    p_room: archiveRoom.id,
    p_user: user,
    p_action: "restore",
  });
  assert.equal(
    endedRestored.status,
    "stopped",
    "Ended rooms stay ended after restoration",
  );
  console.log(
    "PASS archive/restore persistence, ownership, pause guards, retained replies and ended rooms",
  );
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
        p_weekly_budget: 10,
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
  const weeklyUser = ids[1];
  r = await start(
    (await room(weeklyUser, { mode: "free", concurrency: 3 })).id,
    weeklyUser,
  );
  claims = await Promise.all(
    Array.from({ length: 8 }, () =>
      rpc("claim_turn", {
        p_room: r.id,
        p_user: weeklyUser,
        p_run: r.run_id,
        p_prices: quotes,
        p_weekly_budget: 0.015,
      }),
    ),
  );
  assert.equal(
    claims.filter(Boolean).length,
    1,
    "Weekly reservations serialize under contention",
  );
  await finish(claims.find(Boolean), 0.01);
  assert.equal(
    await rpc("claim_turn", {
      p_room: r.id,
      p_user: weeklyUser,
      p_run: r.run_id,
      p_prices: quotes,
      p_weekly_budget: 0.015,
    }),
    null,
  );
  assert.equal(
    (await admin.from("rooms").select("reason").eq("id", r.id).single()).data!
      .reason,
    "Weekly account budget: not enough available to reserve another reply. Resets Monday at 00:00 UTC.",
  );
  console.log(
    "PASS per-bot quota, session duration, old-run fencing, atomic weekly budget",
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
    p_weekly_budget: 10,
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
    (await admin.rpc("claim_summary", { ...nextArgs, p_weekly_budget: 0.005 }))
      .error,
    "Weekly spending includes summaries",
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
  const meterUser = ids[2];
  // Seed running rooms directly to exercise cross-room budget protection independently
  // of room_action's normal one-running-room guard.
  async function startMeterRoom(id: string, user: string) {
    const result = await admin
      .from("rooms")
      .update({
        status: "running",
        run_id: crypto.randomUUID(),
        run_started_at: new Date().toISOString(),
        reason: null,
      })
      .eq("id", id)
      .eq("user_id", user)
      .select()
      .single();
    assert.ifError(result.error);
    return result.data;
  }
  const meter = (standard = 10, premium: number | null = null) =>
    rpc("account_usage", {
      p_user: meterUser,
      p_weekly_budget: standard,
      p_premium_weekly_budget: premium,
    });
  let usage = await meter();
  assert.equal(usage.tier, "standard");
  assert.equal(usage.limit, 10);
  assert.equal(usage.used, 0);
  assert.equal(usage.remaining, 10);
  assert.equal(new Date(usage.periodStart).getUTCDay(), 1);
  assert.equal(new Date(usage.periodStart).getUTCHours(), 0);
  assert.equal(
    Date.parse(usage.resetsAt) - Date.parse(usage.periodStart),
    7 * 86400000,
  );
  const anonymous = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  for (const table of ["account_billing", "usage_events"]) {
    assert.ok(
      (await anonymous.from(table).select("*")).error,
      `${table}: anonymous reads denied`,
    );
    assert.equal(
      (await clients[0].from(table).select("*").eq("user_id", meterUser)).data!
        .length,
      0,
    );
  }
  assert.ok(
    (
      await clients[2]
        .from("account_billing")
        .update({ is_premium: true })
        .eq("user_id", meterUser)
    ).error,
  );
  assert.ok(
    (
      await clients[2]
        .from("account_billing")
        .insert({ user_id: meterUser, is_premium: true })
    ).error,
  );
  assert.ok(
    (await clients[2].from("usage_events").delete().eq("user_id", meterUser))
      .error,
  );
  assert.ok(
    (await clients[2].rpc("account_usage", { p_user: meterUser })).error,
  );
  assert.ok(
    (
      await admin.rpc("account_usage", {
        p_user: meterUser,
        p_weekly_budget: null,
      })
    ).error,
  );
  assert.ok(
    (
      await admin.rpc("account_usage", {
        p_user: meterUser,
        p_premium_weekly_budget: -1,
      })
    ).error,
  );
  assert.ifError(
    (await clients[2].auth.updateUser({ data: { is_premium: true } })).error,
  );
  assert.equal(
    (await meter()).tier,
    "standard",
    "User-editable metadata cannot upgrade an account",
  );
  console.log(
    "PASS default weekly allowance, UTC reset, billing/ledger RLS and upgrade protection",
  );

  const meterRooms = await Promise.all(
    Array.from({ length: 8 }, async () =>
      startMeterRoom((await room(meterUser)).id, meterUser),
    ),
  );
  const meteredClaim = (
    target: typeof r,
    standard: number,
    premium: number | null = null,
  ) =>
    rpc("claim_turn", {
      p_room: target.id,
      p_user: meterUser,
      p_run: target.run_id,
      p_prices: quotes,
      p_weekly_budget: standard,
      p_premium_weekly_budget: premium,
    });
  const crossRoomClaims = await Promise.all(
    meterRooms.map((target) => meteredClaim(target, 0.015)),
  );
  assert.equal(
    crossRoomClaims.filter(Boolean).length,
    1,
    "Reservations serialize across different rooms",
  );
  const meteredReply = crossRoomClaims.find(Boolean);
  usage = await meter(0.015);
  assert.equal(usage.used, 0.01);
  assert.equal(usage.pending, 0.01);
  assert.equal(usage.remaining, 0.005);
  await finish(meteredReply, 0.004);
  assert.equal(
    await finish(meteredReply, 0.1),
    false,
    "Settlement is idempotent",
  );
  usage = await meter(0.015);
  assert.equal(usage.spent, 0.004);
  assert.equal(usage.pending, 0);
  const nextMeterRoom = await startMeterRoom(
    (await room(meterUser)).id,
    meterUser,
  );
  const reservedAgain = await meteredClaim(nextMeterRoom, 0.015);
  assert.ok(reservedAgain, "Settlement releases unused reservation");
  await rpc("finish_turn", {
    p_room: reservedAgain.room_id,
    p_message: reservedAgain.id,
    p_content: "",
    p_cost: null,
    p_input: null,
    p_output: null,
    p_error: "Uncertain provider outcome",
  });
  usage = await meter(0.015);
  assert.equal(usage.used, 0.014);
  assert.equal(usage.uncertain, 0.01);
  assert.equal(usage.pending, 0);
  const beforeDelete = usage.used;
  assert.ifError(
    (await admin.from("rooms").delete().eq("id", nextMeterRoom.id)).error,
  );
  assert.equal(
    (await meter()).used,
    beforeDelete,
    "Deleting a room cannot restore allowance",
  );
  const ledgerRow = await admin
    .from("usage_events")
    .select("*")
    .eq("source_id", reservedAgain.id)
    .single();
  assert.ifError(ledgerRow.error);
  assert.equal(ledgerRow.data.room_id, null);
  console.log(
    "PASS cross-room contention, metered settlements, uncertain requests and durable usage",
  );

  assert.ifError(
    (
      await admin
        .from("account_billing")
        .update({ is_premium: true })
        .eq("user_id", meterUser)
    ).error,
  );
  usage = await meter(0.015);
  assert.equal(usage.tier, "premium");
  assert.equal(usage.limit, null);
  assert.equal(usage.remaining, null);
  const unlimitedRoom = await startMeterRoom(
    (await room(meterUser)).id,
    meterUser,
  );
  const unlimitedReply = await meteredClaim(unlimitedRoom, 0);
  assert.ok(unlimitedReply, "Unlimited premium bypasses the standard cap");
  await finish(unlimitedReply, 0.02);
  const cappedPremiumRoom = await startMeterRoom(
    (await room(meterUser)).id,
    meterUser,
  );
  assert.equal(await meteredClaim(cappedPremiumRoom, 0, 0.04), null);
  const raisedPremium = await meteredClaim(
    await startMeterRoom(cappedPremiumRoom.id, meterUser),
    0,
    0.1,
  );
  assert.ok(
    raisedPremium,
    "Raising the premium env allowance restores eligibility",
  );
  await finish(raisedPremium, 0.001);
  assert.equal((await meter(0, 0)).remaining, 0);
  assert.equal(
    await meteredClaim(
      await startMeterRoom((await room(meterUser)).id, meterUser),
      0,
      0,
    ),
    null,
  );
  const premiumRoomLimit = await startMeterRoom(
    (await room(meterUser, { budget: 0.001 })).id,
    meterUser,
  );
  assert.equal(
    await meteredClaim(premiumRoomLimit, 10),
    null,
    "Unlimited premium retains room limits",
  );
  assert.ifError(
    (
      await admin
        .from("account_billing")
        .update({ is_premium: false })
        .eq("user_id", meterUser)
    ).error,
  );
  assert.equal((await meter(0.015)).tier, "standard");
  assert.equal(
    await meteredClaim(
      await startMeterRoom((await room(meterUser)).id, meterUser),
      0.015,
    ),
    null,
    "Downgrade applies immediately without resetting spend",
  );
  console.log(
    "PASS premium unlimited/finite/zero limits, upgrades, downgrades and retained room caps",
  );

  const meterSummaryRoom = await room(meterUser);
  const summarySource = await admin
    .from("messages")
    .insert({
      room_id: meterSummaryRoom.id,
      bot_id: DEFAULT_BOTS[0].id,
      speaker: "Planner",
      content: "A useful point",
      cost: 0,
    })
    .select()
    .single();
  assert.ifError(summarySource.error);
  const meterSummaryArgs = {
    p_room: meterSummaryRoom.id,
    p_user: meterUser,
    p_request: crypto.randomUUID(),
    p_model: DEFAULT_BOTS[0].model,
    p_source_ids: [summarySource.data.id],
    p_quote: 0.01,
    p_weekly_budget: 0.015,
  };
  assert.ok(
    (await admin.rpc("claim_summary", meterSummaryArgs)).error,
    "Replies consume summary allowance too",
  );
  const meterSummary = await rpc("claim_summary", {
    ...meterSummaryArgs,
    p_weekly_budget: 1,
  });
  const usageWithSummary = await meter(1);
  assert.equal(usageWithSummary.pending, 0.01);
  assert.equal(
    (await rpc("claim_summary", { ...meterSummaryArgs, p_weekly_budget: 1 }))
      .claimed,
    false,
  );
  assert.equal(
    (await meter(1)).used,
    usageWithSummary.used,
    "Duplicate summary request does not double meter",
  );
  await rpc("finish_summary", {
    p_summary: meterSummary.summary.id,
    p_content: "Summary",
    p_cost: 0.003,
  });
  assert.equal((await meter(1)).pending, 0);
  assert.equal((await meter(1)).spent, 0.028);
  console.log(
    "PASS shared reply/summary ledger, summary idempotency and settlement",
  );

  // Boundary fixtures affect only the disposable test account's ledger.
  assert.ifError(
    (await admin.from("usage_events").delete().eq("user_id", meterUser)).error,
  );
  usage = await meter();
  const weekStart = Date.parse(usage.periodStart),
    weekEnd = Date.parse(usage.resetsAt);
  for (const [timestamp, cost] of [
    [weekStart - 1, 100],
    [weekStart, 1],
    [weekEnd - 1, 2],
    [weekEnd, 100],
  ]) {
    assert.ifError(
      (
        await admin.from("usage_events").insert({
          source_id: crypto.randomUUID(),
          user_id: meterUser,
          kind: "reply",
          status: "complete",
          reserved_cost: cost,
          cost,
          created_at: new Date(timestamp).toISOString(),
        })
      ).error,
    );
  }
  assert.equal(
    (await meter()).used,
    3,
    "Week includes Monday start and excludes next Monday",
  );
  assert.ifError(
    (
      await admin
        .from("usage_events")
        .update({ created_at: new Date(weekStart - 1).toISOString() })
        .eq("user_id", meterUser)
    ).error,
  );
  assert.equal(
    (await meter()).used,
    0,
    "Previous-week spend does not consume new allowance",
  );
  assert.equal((await meter()).remaining, 10, "No unused allowance rolls over");
  console.log(
    "PASS exact weekly boundaries and fresh allowance without rollover",
  );
  console.log("All integration checks passed. No Gateway calls were made.");
} finally {
  for (const id of ids)
    assert.ifError((await admin.auth.admin.deleteUser(id)).error);
}
