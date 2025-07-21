import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  users: defineTable({
    phoneNumber: v.string(),
    balance: v.number(),
    welcomeBonusUsed: v.boolean(),
    welcomeBonusUnlocked: v.boolean(),
    totalWinnings: v.number(),
    hasDeposited: v.boolean(),
    hasPlayedAfterDeposit: v.boolean(),
    canWithdraw: v.boolean(),
    referralCode: v.string(),
    referredBy: v.optional(v.id("users")),
    totalReferrals: v.number(),
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_referral_code", ["referralCode"]),

  transactions: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("deposit"), v.literal("withdrawal"), v.literal("bonus"), v.literal("referral"), v.literal("game_win"), v.literal("game_loss")),
    amount: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    mpesaTransactionId: v.optional(v.string()),
    description: v.string(),
  }).index("by_user", ["userId"]),

  games: defineTable({
    userId: v.id("users"),
    gameType: v.string(),
    stake: v.number(),
    result: v.union(v.literal("win"), v.literal("loss")),
    winAmount: v.number(),
    multiplier: v.number(),
  }).index("by_user", ["userId"]),

  referrals: defineTable({
    referrerId: v.id("users"),
    referredUserId: v.id("users"),
    bonusAwarded: v.boolean(),
  })
    .index("by_referrer", ["referrerId"])
    .index("by_referred", ["referredUserId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
