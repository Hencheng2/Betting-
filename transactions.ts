import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getUserTransactions = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});

export const processWithdrawal = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.canWithdraw) {
      throw new Error("Withdrawal not allowed. Complete requirements first.");
    }

    if (args.amount <= 0 || args.amount > user.balance) {
      throw new Error("Invalid withdrawal amount");
    }

    if (args.amount < 10) {
      throw new Error("Minimum withdrawal amount is 10 KES");
    }

    // Deduct amount from balance
    await ctx.db.patch(args.userId, {
      balance: user.balance - args.amount,
    });

    // Record withdrawal transaction
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "withdrawal",
      amount: -args.amount,
      status: "pending",
      description: `Withdrawal to ${args.phoneNumber}`,
    });

    return { success: true, newBalance: user.balance - args.amount };
  },
});
