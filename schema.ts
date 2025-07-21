import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server"; // Keep if you plan to use Convex auth later, otherwise can be removed.

const applicationTables = {
  users: defineTable({
    phoneNumber: v.string(),
    balance: v.number(),
    // welcomeBonusUsed: v.boolean(), // Removed as 'welcomeBonusUnlocked' and 'totalWinnings' handle this state
    welcomeBonusUnlocked: v.boolean(),
    totalWinnings: v.number(),
    hasDeposited: v.boolean(),
    hasPlayedAfterDeposit: v.boolean(),
    canWithdraw: v.boolean(), // Aggregates all withdrawal conditions
    referralCode: v.string(),
    referredBy: v.optional(v.id("users")), // Optional ID of the referrer
    totalReferrals: v.number(),
  })
    .index("by_phone", ["phoneNumber"]) // Index for quick phone number lookups
    .index("by_referral_code", ["referralCode"]), // Index for quick referral code lookups

  transactions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("bonus"),
      v.literal("referral"),
      v.literal("game_win"),
      v.literal("game_loss")
    ),
    amount: v.number(), // Can be positive (credit) or negative (debit)
    status: v.union(
      v.literal("pending"), // e.g., for withdrawals before M-Pesa payout
      v.literal("completed"),
      v.literal("failed")
    ),
    mpesaTransactionId: v.optional(v.string()), // For deposit confirmation
    description: v.string(), // Human-readable description
  }).index("by_user", ["userId"]), // Index for fetching user's transactions

  games: defineTable({
    userId: v.id("users"),
    gameType: v.string(), // e.g., "spinning"
    stake: v.number(),
    result: v.union(v.literal("win"), v.literal("loss")),
    winAmount: v.number(), // Amount won (0 if loss)
    multiplier: v.number(), // e.g., 100x for spinning game
  }).index("by_user", ["userId"]), // Index for fetching user's game history

  referrals: defineTable({
    referrerId: v.id("users"),
    referredUserId: v.id("users"),
    bonusAwarded: v.boolean(), // To prevent awarding bonus multiple times for same referral
  })
    .index("by_referrer", ["referrerId"]) // Index for finding referrals made by a user
    .index("by_referred", ["referredUserId"]), // Index for finding who referred a specific user
};

export default defineSchema({
  ...authTables, // Keep this line if you use @convex-dev/auth, otherwise remove it.
  ...applicationTables,
});
