import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

const avatarValidator = v.object({
  body: v.number(),
  face: v.number(),
  hair: v.number(),
  accessory: v.number(),
  background: v.number(),
});

const pushSubscriptionValidator = v.object({
  endpoint: v.string(),
  expirationTime: v.optional(v.union(v.number(), v.null())),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

type QueueEntry = Doc<"queueEntries">;
type WipeResult = { deleted: number; continuing: boolean };

const liveStatuses = new Set(["waiting", "ready", "singing"]);
const wipeBatchSize = 80;

function cleanText(value: string, fallback: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed.slice(0, 120) : fallback;
}

function optionalText(value: string | undefined) {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, 160) : undefined;
}

function extractYoutubeId(input: string | undefined) {
  if (!input) {
    return undefined;
  }
  const value = input.trim();
  if (!value) {
    return undefined;
  }
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return match[1].slice(0, 32);
    }
  }
  return /^[a-zA-Z0-9_-]{6,32}$/.test(value) ? value : undefined;
}

function orderedQueue(entries: QueueEntry[]) {
  return [...entries].sort((a, b) => {
    const aOverride = a.positionOverride ?? Number.POSITIVE_INFINITY;
    const bOverride = b.positionOverride ?? Number.POSITIVE_INFINITY;
    if (aOverride !== bOverride) {
      return aOverride - bOverride;
    }
    if (a.priorityScore !== b.priorityScore) {
      return a.priorityScore - b.priorityScore;
    }
    return a.createdAt - b.createdAt;
  });
}

async function activeSession(ctx: QueryCtx | MutationCtx) {
  const active = await ctx.db
    .query("sessions")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .order("desc")
    .take(1);
  if (active[0]) {
    return active[0];
  }
  const onBreak = await ctx.db
    .query("sessions")
    .withIndex("by_status", (q) => q.eq("status", "break"))
    .order("desc")
    .take(1);
  return onBreak[0] ?? null;
}

async function getSession(ctx: QueryCtx | MutationCtx, sessionId?: Id<"sessions">) {
  if (sessionId) {
    return await ctx.db.get(sessionId);
  }
  return await activeSession(ctx);
}

async function liveQueue(ctx: QueryCtx | MutationCtx, sessionId: Id<"sessions">) {
  const entries = await ctx.db
    .query("queueEntries")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .take(150);
  return orderedQueue(entries.filter((entry) => liveStatuses.has(entry.status)));
}

async function activeSingers(ctx: QueryCtx | MutationCtx, sessionId: Id<"sessions">) {
  const singers = await ctx.db
    .query("singers")
    .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
    .take(150);
  return singers
    .filter((singer) => !singer.removedAt)
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

async function notifySecondPosition(ctx: MutationCtx, sessionId: Id<"sessions">) {
  const queue = (await liveQueue(ctx, sessionId)).filter(
    (entry) => entry.status === "waiting" || entry.status === "ready",
  );
  const second = queue[1];
  if (!second) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.notifications.sendUpNextPush, {
    singerId: second.singerId,
  });
  if (second.duetSingerId) {
    await ctx.scheduler.runAfter(0, internal.notifications.sendUpNextPush, {
      singerId: second.duetSingerId,
    });
  }
}

async function nextWaiting(ctx: QueryCtx | MutationCtx, sessionId: Id<"sessions">) {
  const queue = await liveQueue(ctx, sessionId);
  return queue.find((entry) => entry.status === "waiting") ?? null;
}

async function summarizeReactions(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
  queueEntryId: Id<"queueEntries">,
) {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_sessionId_and_queueEntryId", (q) =>
      q.eq("sessionId", sessionId).eq("queueEntryId", queueEntryId),
    )
    .take(500);
  const counts: Record<string, number> = {};
  for (const reaction of reactions) {
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
}

async function clearReactions(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
  queueEntryId: Id<"queueEntries">,
) {
  const reactions = await ctx.db
    .query("reactions")
    .withIndex("by_sessionId_and_queueEntryId", (q) =>
      q.eq("sessionId", sessionId).eq("queueEntryId", queueEntryId),
    )
    .take(500);
  for (const reaction of reactions) {
    await ctx.db.delete(reaction._id);
  }
}

async function deleteWipeBatch(ctx: MutationCtx) {
  let deleted = 0;
  let continuing = false;

  const reactions = await ctx.db.query("reactions").take(wipeBatchSize);
  continuing ||= reactions.length === wipeBatchSize;
  for (const row of reactions) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }

  const history = await ctx.db.query("performanceHistory").take(wipeBatchSize);
  continuing ||= history.length === wipeBatchSize;
  for (const row of history) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }

  const queueEntries = await ctx.db.query("queueEntries").take(wipeBatchSize);
  continuing ||= queueEntries.length === wipeBatchSize;
  for (const row of queueEntries) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }

  const singers = await ctx.db.query("singers").take(wipeBatchSize);
  continuing ||= singers.length === wipeBatchSize;
  for (const row of singers) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }

  const sessions = await ctx.db.query("sessions").take(wipeBatchSize);
  continuing ||= sessions.length === wipeBatchSize;
  for (const row of sessions) {
    await ctx.db.delete(row._id);
    deleted += 1;
  }

  return { deleted, continuing: continuing || deleted > 0 };
}

async function finishEntry(ctx: MutationCtx, entry: QueueEntry, finalStatus: "done" | "skipped") {
  const now = Date.now();
  const reactionSummary = await summarizeReactions(ctx, entry.sessionId, entry._id);
  const applauseCount = reactionSummary
    .filter((reaction) => reaction.emoji === "👏")
    .reduce((sum, reaction) => sum + reaction.count, 0);

  if (finalStatus === "done") {
    await ctx.db.insert("performanceHistory", {
      sessionId: entry.sessionId,
      queueEntryId: entry._id,
      singerId: entry.singerId,
      duetSingerId: entry.duetSingerId,
      duetManualName: entry.duetManualName,
      songTitle: entry.songTitle,
      source: entry.source,
      youtubeVideoId: entry.youtubeVideoId,
      dedication: entry.dedication,
      startedAt: entry.startedAt,
      completedAt: now,
      applauseCount,
      reactionSummary,
    });

    const singer = await ctx.db.get(entry.singerId);
    if (singer) {
      await ctx.db.patch(singer._id, { timesSung: singer.timesSung + 1 });
    }
    if (entry.duetSingerId) {
      const duetSinger = await ctx.db.get(entry.duetSingerId);
      if (duetSinger) {
        await ctx.db.patch(duetSinger._id, { timesSung: duetSinger.timesSung + 1 });
      }
    }
  }

  await ctx.db.patch(entry._id, {
    status: finalStatus,
    completedAt: now,
    positionOverride: undefined,
  });
  await clearReactions(ctx, entry.sessionId, entry._id);
}

async function setReadyToNext(ctx: MutationCtx, sessionId: Id<"sessions">) {
  const next = await nextWaiting(ctx, sessionId);
  const session = await ctx.db.get(sessionId);
  if (!session) {
    return null;
  }
  if (!next) {
    await ctx.db.patch(sessionId, {
      stage: "idle",
      activeEntryId: undefined,
      readyEntryId: undefined,
      customVideoExpected: false,
    });
    return null;
  }
  await ctx.db.patch(next._id, { status: "ready" });
  await ctx.db.patch(sessionId, {
    stage: "ready",
    activeEntryId: undefined,
    readyEntryId: next._id,
    customVideoExpected: next.source === "custom",
  });
  await notifySecondPosition(ctx, sessionId);
  return next._id;
}

export const activeSessionView = query({
  args: {},
  handler: async (ctx) => {
    return await activeSession(ctx);
  },
});

export const sessionView = query({
  args: { sessionId: v.optional(v.id("sessions")) },
  handler: async (ctx, args) => {
    const session = await getSession(ctx, args.sessionId);
    if (!session) {
      return null;
    }
    return session;
  },
});

export const managementView = query({
  args: { sessionId: v.optional(v.id("sessions")) },
  handler: async (ctx, args) => {
    const session = await getSession(ctx, args.sessionId);
    if (!session) {
      return null;
    }
    const [queue, singers, history] = await Promise.all([
      liveQueue(ctx, session._id),
      activeSingers(ctx, session._id),
      ctx.db
        .query("performanceHistory")
        .withIndex("by_sessionId", (q) => q.eq("sessionId", session._id))
        .order("desc")
        .take(100),
    ]);
    return {
      session,
      queue,
      singers,
      history,
      activeEntry: session.activeEntryId ? await ctx.db.get(session.activeEntryId) : null,
      readyEntry: session.readyEntryId ? await ctx.db.get(session.readyEntryId) : null,
    };
  },
});

export const displayView = query({
  args: { sessionId: v.optional(v.id("sessions")) },
  handler: async (ctx, args) => {
    const session = await getSession(ctx, args.sessionId);
    if (!session) {
      return null;
    }
    const queue = await liveQueue(ctx, session._id);
    const singers = await activeSingers(ctx, session._id);
    const activeEntry = session.activeEntryId ? await ctx.db.get(session.activeEntryId) : null;
    const readyEntry = session.readyEntryId ? await ctx.db.get(session.readyEntryId) : null;
    const reactionEntryId = activeEntry?._id ?? readyEntry?._id;
    const reactions = reactionEntryId
      ? await ctx.db
          .query("reactions")
          .withIndex("by_sessionId_and_queueEntryId", (q) =>
            q.eq("sessionId", session._id).eq("queueEntryId", reactionEntryId),
          )
          .order("desc")
          .take(80)
      : [];
    return { session, queue, singers, activeEntry, readyEntry, reactions };
  },
});

export const guestView = query({
  args: { singerId: v.id("singers") },
  handler: async (ctx, args) => {
    const singer = await ctx.db.get(args.singerId);
    if (!singer || singer.removedAt) {
      return null;
    }
    const session = await ctx.db.get(singer.sessionId);
    if (!session) {
      return null;
    }
    const [queue, singers, ownEntries, asDuetHistory, ownHistory] = await Promise.all([
      liveQueue(ctx, session._id),
      activeSingers(ctx, session._id),
      ctx.db
        .query("queueEntries")
        .withIndex("by_singerId", (q) => q.eq("singerId", singer._id))
        .order("desc")
        .take(40),
      ctx.db
        .query("performanceHistory")
        .withIndex("by_duetSingerId", (q) => q.eq("duetSingerId", singer._id))
        .order("desc")
        .take(40),
      ctx.db
        .query("performanceHistory")
        .withIndex("by_singerId", (q) => q.eq("singerId", singer._id))
        .order("desc")
        .take(40),
    ]);
    const queuePosition =
      queue.findIndex(
        (entry) =>
          entry.status !== "singing" &&
          (entry.singerId === singer._id || entry.duetSingerId === singer._id),
      ) + 1;
    return {
      session,
      singer,
      queue,
      singers,
      ownEntries,
      history: [...ownHistory, ...asDuetHistory].sort((a, b) => b.completedAt - a.completedAt),
      queuePosition,
      activeEntry: session.activeEntryId ? await ctx.db.get(session.activeEntryId) : null,
      readyEntry: session.readyEntryId ? await ctx.db.get(session.readyEntryId) : null,
    };
  },
});

export const createSession = mutation({
  args: { name: v.string(), themeLabel: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await activeSession(ctx);
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert("sessions", {
      name: cleanText(args.name, "Karaoke Palace"),
      status: "active",
      stage: "idle",
      themeLabel: cleanText(args.themeLabel ?? "Karaoke Palace", "Karaoke Palace"),
      customVideoExpected: false,
      createdAt: Date.now(),
    });
  },
});

export const joinSession = mutation({
  args: {
    sessionId: v.id("sessions"),
    displayName: v.string(),
    avatar: avatarValidator,
    notificationPermission: v.optional(
      v.union(v.literal("default"), v.literal("granted"), v.literal("denied")),
    ),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status === "ended") {
      throw new Error("This session is no longer open.");
    }
    return await ctx.db.insert("singers", {
      sessionId: args.sessionId,
      displayName: cleanText(args.displayName, "Guest Singer"),
      avatar: args.avatar,
      timesSung: 0,
      joinedAt: Date.now(),
      notificationPermission: args.notificationPermission ?? "default",
    });
  },
});

export const savePushSubscription = mutation({
  args: {
    singerId: v.id("singers"),
    pushSubscription: v.optional(pushSubscriptionValidator),
    notificationPermission: v.union(
      v.literal("default"),
      v.literal("granted"),
      v.literal("denied"),
    ),
  },
  handler: async (ctx, args) => {
    const singer = await ctx.db.get(args.singerId);
    if (!singer) {
      return null;
    }
    await ctx.db.patch(args.singerId, {
      pushSubscription: args.pushSubscription,
      notificationPermission: args.notificationPermission,
    });
    return args.singerId;
  },
});

export const submitSong = mutation({
  args: {
    singerId: v.id("singers"),
    songTitle: v.string(),
    youtubeUrl: v.optional(v.string()),
    dedication: v.optional(v.string()),
    duetSingerId: v.optional(v.id("singers")),
    duetManualName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const singer = await ctx.db.get(args.singerId);
    if (!singer || singer.removedAt) {
      throw new Error("Singer is not active.");
    }
    const session = await ctx.db.get(singer.sessionId);
    if (!session || session.status === "ended") {
      throw new Error("Session is not active.");
    }
    if (args.duetSingerId) {
      const duetSinger = await ctx.db.get(args.duetSingerId);
      if (!duetSinger || duetSinger.sessionId !== singer.sessionId || duetSinger.removedAt) {
        throw new Error("Duet partner is not available.");
      }
    }
    const existingRequest = (await liveQueue(ctx, singer.sessionId)).find(
      (entry) =>
        entry.singerId === singer._id ||
        entry.duetSingerId === singer._id ||
        (args.duetSingerId &&
          (entry.singerId === args.duetSingerId || entry.duetSingerId === args.duetSingerId)),
    );
    if (existingRequest) {
      throw new Error("You already have a song in the active queue.");
    }

    const now = Date.now();
    const youtubeVideoId = extractYoutubeId(args.youtubeUrl);
    const singers = await activeSingers(ctx, singer.sessionId);
    const anyoneHasSung = singers.some((candidate) => candidate.timesSung > 0);
    const firstTimerBoost = singer.timesSung === 0 && anyoneHasSung ? 180000 : 0;
    const repeatPenalty = singer.timesSung * 600000;

    const entryId = await ctx.db.insert("queueEntries", {
      sessionId: singer.sessionId,
      singerId: singer._id,
      duetSingerId: args.duetSingerId,
      duetManualName: optionalText(args.duetManualName),
      songTitle: cleanText(args.songTitle, "Untitled Jam"),
      youtubeVideoId,
      source: youtubeVideoId ? "youtube" : "custom",
      dedication: optionalText(args.dedication),
      status: "waiting",
      priorityScore: now + repeatPenalty - firstTimerBoost,
      createdAt: now,
    });

    if (session.stage === "idle" && session.status === "active") {
      await setReadyToNext(ctx, session._id);
    } else {
      await notifySecondPosition(ctx, session._id);
    }
    return entryId;
  },
});

export const markReadyToStart = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await setReadyToNext(ctx, args.sessionId);
  },
});

export const startReadyEntry = mutation({
  args: { sessionId: v.id("sessions"), singerId: v.optional(v.id("singers")) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.readyEntryId || session.status === "ended") {
      return null;
    }
    const entry = await ctx.db.get(session.readyEntryId);
    if (!entry || entry.status !== "ready") {
      return null;
    }
    if (
      args.singerId &&
      entry.singerId !== args.singerId &&
      entry.duetSingerId !== args.singerId
    ) {
      throw new Error("Only the next singer can start this song.");
    }
    await ctx.db.patch(entry._id, { status: "singing", startedAt: Date.now() });
    await ctx.db.patch(session._id, {
      stage: "playing",
      activeEntryId: entry._id,
      readyEntryId: undefined,
      customVideoExpected: entry.source === "custom",
    });
    return entry._id;
  },
});

export const advanceCurrent = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session?.activeEntryId) {
      return await setReadyToNext(ctx, args.sessionId);
    }
    const entry = await ctx.db.get(session.activeEntryId);
    if (entry) {
      await finishEntry(ctx, entry, "done");
    }
    return await setReadyToNext(ctx, args.sessionId);
  },
});

export const skipEntry = mutation({
  args: { entryId: v.id("queueEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }
    if (entry.status === "singing") {
      await finishEntry(ctx, entry, "skipped");
      return await setReadyToNext(ctx, entry.sessionId);
    }
    await ctx.db.patch(entry._id, {
      status: "skipped",
      completedAt: Date.now(),
      positionOverride: undefined,
    });
    const session = await ctx.db.get(entry.sessionId);
    if (session?.readyEntryId === entry._id || session?.activeEntryId === entry._id) {
      return await setReadyToNext(ctx, entry.sessionId);
    }
    return entry._id;
  },
});

export const removeEntry = mutation({
  args: { entryId: v.id("queueEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }
    await ctx.db.patch(entry._id, {
      status: "removed",
      completedAt: Date.now(),
      positionOverride: undefined,
    });
    const session = await ctx.db.get(entry.sessionId);
    if (session?.readyEntryId === entry._id || session?.activeEntryId === entry._id) {
      return await setReadyToNext(ctx, entry.sessionId);
    }
    return entry._id;
  },
});

export const promoteEntry = mutation({
  args: { entryId: v.id("queueEntries") },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }
    const queue = await liveQueue(ctx, entry.sessionId);
    let position = 0;
    for (const item of queue) {
      if (item._id === entry._id || item.status === "singing" || item.status === "ready") {
        continue;
      }
      position += 1;
      await ctx.db.patch(item._id, { positionOverride: position });
    }
    await ctx.db.patch(entry._id, { positionOverride: 0 });
    return entry._id;
  },
});

export const reorderEntry = mutation({
  args: { entryId: v.id("queueEntries"), beforeEntryId: v.optional(v.id("queueEntries")) },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }
    const queue = (await liveQueue(ctx, entry.sessionId)).filter(
      (item) => item.status === "waiting",
    );
    const withoutEntry = queue.filter((item) => item._id !== entry._id);
    const beforeIndex = args.beforeEntryId
      ? withoutEntry.findIndex((item) => item._id === args.beforeEntryId)
      : withoutEntry.length;
    const nextQueue = [...withoutEntry];
    nextQueue.splice(beforeIndex < 0 ? nextQueue.length : beforeIndex, 0, entry);
    for (let index = 0; index < nextQueue.length; index += 1) {
      await ctx.db.patch(nextQueue[index]._id, { positionOverride: index });
    }
    return entry._id;
  },
});

export const resetAutoSort = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    const queue = await liveQueue(ctx, args.sessionId);
    for (const entry of queue) {
      await ctx.db.patch(entry._id, { positionOverride: undefined });
    }
    return args.sessionId;
  },
});

export const toggleEntrySource = mutation({
  args: { entryId: v.id("queueEntries"), source: v.union(v.literal("youtube"), v.literal("custom")) },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) {
      return null;
    }
    await ctx.db.patch(entry._id, {
      source: args.source,
      youtubeVideoId: args.source === "custom" ? undefined : entry.youtubeVideoId,
    });
    return entry._id;
  },
});

export const setBreakMode = mutation({
  args: { sessionId: v.id("sessions"), enabled: v.boolean(), message: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.status === "ended") {
      return null;
    }
    await ctx.db.patch(args.sessionId, {
      status: args.enabled ? "break" : "active",
      breakMessage: args.enabled ? optionalText(args.message) : undefined,
    });
    return args.sessionId;
  },
});

export const endSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      status: "ended",
      stage: "idle",
      activeEntryId: undefined,
      readyEntryId: undefined,
      endedAt: Date.now(),
    });
    return args.sessionId;
  },
});

export const removeSinger = mutation({
  args: { singerId: v.id("singers") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.singerId, { removedAt: Date.now() });
    return args.singerId;
  },
});

export const sendReaction = mutation({
  args: { singerId: v.id("singers"), emoji: v.string() },
  handler: async (ctx, args) => {
    const singer = await ctx.db.get(args.singerId);
    if (!singer || singer.removedAt) {
      return null;
    }
    const session = await ctx.db.get(singer.sessionId);
    if (!session?.activeEntryId || session.stage !== "playing") {
      return null;
    }
    const emoji = args.emoji.slice(0, 8);
    return await ctx.db.insert("reactions", {
      sessionId: singer.sessionId,
      queueEntryId: session.activeEntryId,
      singerId: singer._id,
      emoji,
      createdAt: Date.now(),
    });
  },
});

export const continueWipeAllForTesting = internalMutation({
  args: {},
  handler: async (ctx): Promise<WipeResult> => {
    const result = await deleteWipeBatch(ctx);
    if (result.continuing) {
      await ctx.scheduler.runAfter(0, internal.karaoke.continueWipeAllForTesting, {});
    }
    return result;
  },
});

export const wipeAllForTesting = mutation({
  args: { confirm: v.literal("WIPE_KARAOKE_DB") },
  handler: async (ctx): Promise<WipeResult> => {
    const result = await deleteWipeBatch(ctx);
    if (result.continuing) {
      await ctx.scheduler.runAfter(0, internal.karaoke.continueWipeAllForTesting, {});
    }
    return result;
  },
});
