import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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

const reactionSummaryValidator = v.array(
  v.object({
    emoji: v.string(),
    count: v.number(),
  }),
);

export default defineSchema({
  sessions: defineTable({
    name: v.string(),
    status: v.union(v.literal("active"), v.literal("break"), v.literal("ended")),
    stage: v.union(v.literal("idle"), v.literal("ready"), v.literal("playing")),
    themeLabel: v.string(),
    breakMessage: v.optional(v.string()),
    activeEntryId: v.optional(v.id("queueEntries")),
    readyEntryId: v.optional(v.id("queueEntries")),
    customVideoExpected: v.boolean(),
    createdAt: v.number(),
    endedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_createdAt", ["createdAt"]),

  singers: defineTable({
    sessionId: v.id("sessions"),
    displayName: v.string(),
    avatar: avatarValidator,
    timesSung: v.number(),
    joinedAt: v.number(),
    removedAt: v.optional(v.number()),
    pushSubscription: v.optional(pushSubscriptionValidator),
    notificationPermission: v.optional(
      v.union(v.literal("default"), v.literal("granted"), v.literal("denied")),
    ),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_removedAt", ["sessionId", "removedAt"]),

  queueEntries: defineTable({
    sessionId: v.id("sessions"),
    singerId: v.id("singers"),
    duetSingerId: v.optional(v.id("singers")),
    duetManualName: v.optional(v.string()),
    songTitle: v.string(),
    youtubeVideoId: v.optional(v.string()),
    source: v.union(v.literal("youtube"), v.literal("custom")),
    dedication: v.optional(v.string()),
    status: v.union(
      v.literal("waiting"),
      v.literal("ready"),
      v.literal("singing"),
      v.literal("done"),
      v.literal("skipped"),
      v.literal("removed"),
    ),
    priorityScore: v.number(),
    positionOverride: v.optional(v.number()),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_and_status", ["sessionId", "status"])
    .index("by_singerId", ["singerId"])
    .index("by_duetSingerId", ["duetSingerId"]),

  reactions: defineTable({
    sessionId: v.id("sessions"),
    queueEntryId: v.id("queueEntries"),
    singerId: v.id("singers"),
    emoji: v.string(),
    createdAt: v.number(),
  })
    .index("by_sessionId_and_queueEntryId", ["sessionId", "queueEntryId"])
    .index("by_singerId", ["singerId"]),

  performanceHistory: defineTable({
    sessionId: v.id("sessions"),
    queueEntryId: v.id("queueEntries"),
    singerId: v.id("singers"),
    duetSingerId: v.optional(v.id("singers")),
    duetManualName: v.optional(v.string()),
    songTitle: v.string(),
    source: v.union(v.literal("youtube"), v.literal("custom")),
    youtubeVideoId: v.optional(v.string()),
    dedication: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.number(),
    applauseCount: v.number(),
    reactionSummary: reactionSummaryValidator,
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_singerId", ["singerId"])
    .index("by_duetSingerId", ["duetSingerId"]),
});
