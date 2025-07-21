import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const playSpinningGame = mutation({
  args: {
    userId: v.id("users"),
    stake: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.balance < args.stake) {
      throw new Error("Insufficient balance");
    }

    if (args.stake <= 0 || args.stake > user.balance) {
      throw new Error("Invalid stake amount");
    }

    // Deduct stake from balance
    const newBalance = user.balance - args.stake;
    
    // 0.1% chance of winning (1 in 1000)
    const isWin = Math.random() < 0.001;
    
    let winAmount = 0;
    let multiplier = 0;
    let result: "win" | "loss" = "loss";

    if (isWin) {
      // If win, multiply stake by 100x (to make it worthwhile for the low odds)
      multiplier = 100;
      winAmount = args.stake * multiplier;
      result = "win";
      
      // Add winnings to balance
      await ctx.db.patch(args.userId, {
        balance: newBalance + winAmount,
        totalWinnings: user.totalWinnings + winAmount,
      });
    } else {
      // Just deduct the stake
      await ctx.db.patch(args.userId, {
        balance: newBalance,
      });
    }

    // Check if user has played after deposit (for withdrawal unlock)
    if (user.hasDeposited && !user.hasPlayedAfterDeposit && args.stake <= 10) {
      await ctx.db.patch(args.userId, {
        hasPlayedAfterDeposit: true,
        canWithdraw: true,
      });
    }

    // Check if welcome bonus should be unlocked (300 KES total winnings)
    const updatedUser = await ctx.db.get(args.userId);
    if (updatedUser && !updatedUser.welcomeBonusUnlocked && updatedUser.totalWinnings >= 300) {
      await ctx.db.patch(args.userId, {
        welcomeBonusUnlocked: true,
        canWithdraw: true,
      });
    }

    // Record game transaction
    await ctx.db.insert("games", {
      userId: args.userId,
      gameType: "spinning",
      stake: args.stake,
      result,
      winAmount,
      multiplier,
    });

    // Record transaction
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: result === "win" ? "game_win" : "game_loss",
      amount: result === "win" ? winAmount : -args.stake,
      status: "completed",
      description: `Spinning game ${result}`,
    });

    return {
      result,
      winAmount,
      multiplier,
      newBalance: result === "win" ? newBalance + winAmount : newBalance,
    };
  },
});

export const getUserGames = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
