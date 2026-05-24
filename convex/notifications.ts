import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery, query } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

export const publicConfig = query({
  args: {},
  handler: async () => {
    return {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? null,
    };
  },
});

export const getPushTarget = internalQuery({
  args: { singerId: v.id("singers") },
  handler: async (ctx, args) => {
    const singer = await ctx.db.get(args.singerId);
    if (!singer || singer.removedAt || !singer.pushSubscription) {
      return null;
    }
    const session = await ctx.db.get(singer.sessionId);
    if (!session || session.status === "ended") {
      return null;
    }
    return {
      singerName: singer.displayName,
      sessionName: session.name,
      subscription: singer.pushSubscription,
    };
  },
});

export const sendUpNextPush = internalAction({
  args: { singerId: v.id("singers") },
  handler: async (ctx, args) => {
    const target = await ctx.runQuery(internal.notifications.getPushTarget, {
      singerId: args.singerId,
    });
    if (!target) {
      return { sent: false, reason: "No push target" };
    }

    const payload = JSON.stringify({
      title: `${target.sessionName}: You're up next!`,
      body: `Get ready, ${target.singerName}.`,
      url: "/",
    });

    try {
      const response = await fetch(target.subscription.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ttl: "120",
        },
        body: payload,
      });
      return { sent: response.ok, status: response.status };
    } catch (error) {
      return {
        sent: false,
        reason: error instanceof Error ? error.message : "Push failed",
      };
    }
  },
});
