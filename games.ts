import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel"; // Import Id type

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

    if (args.stake <= 0) { // Added check for non-positive stake
      throw new Error("Invalid stake amount");
    }


    // Deduct stake from balance BEFORE determining win/loss to reflect immediate cost
    const balanceAfterStake = user.balance - args.stake;
    await ctx.db.patch(args.userId, {
        balance: balanceAfterStake,
    });

    // 0.1% chance of winning (1 in 1000)
    const isWin = Math.random() < 0.001; // This implements the 0.1% win chance

    let winAmount = 0;
    let multiplier = 0;
    let result: "win" | "loss" = "loss";

    if (isWin) {
      // If win, multiply stake by 100x
      multiplier = 100;
      winAmount = args.stake * multiplier;
      result = "win";

      // Add winnings to balance
      await ctx.db.patch(args.userId, {
        balance: balanceAfterStake + winAmount, // Add to the balance AFTER stake deduction
        totalWinnings: user.totalWinnings + winAmount,
      });
    } else {
      // Balance was already deducted. No further balance change needed for loss.
    }

    // --- Withdrawal Condition Logic Update ---
    // Fetch the user again to get the latest state after potential balance/winnings updates
    const updatedUser = await ctx.db.get(args.userId);
    if (!updatedUser) { // Should not happen if previous get() succeeded
        throw new Error("Updated user state not found.");
    }

    let shouldBeAbleToWithdraw = updatedUser.canWithdraw; // Preserve existing canWithdraw state

    // Condition 1: Welcome bonus unlocked by winning 300 KES
    if (!updatedUser.welcomeBonusUnlocked && updatedUser.totalWinnings >= 300) {
      await ctx.db.patch(args.userId, {
        welcomeBonusUnlocked: true,
      });
      shouldBeAbleToWithdraw = true;
    }

    // Condition 2: Deposited 20 KES AND played a game with <= 10 KES stake
    // This is ONLY checked if hasDeposited is true and hasPlayedAfterDeposit is false
    if (updatedUser.hasDeposited && !updatedUser.hasPlayedAfterDeposit && args.stake <= 10) {
      await ctx.db.patch(args.userId, {
        hasPlayedAfterDeposit: true,
      });
      shouldBeAbleToWithdraw = true;
    }

    // Finally, update the canWithdraw flag if any condition is met
    if (shouldBeAbleToWithdraw && !updatedUser.canWithdraw) {
         await ctx.db.patch(args.userId, {
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

    // Record main transaction (for dashboard history)
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: result === "win" ? "game_win" : "game_loss",
      amount: result === "win" ? winAmount : -args.stake, // Positive for win, negative for loss
      status: "completed",
      description: `Spinning game (${result})`,
    });


    return {
      result,
      winAmount,
      multiplier,
      newBalance: updatedUser.balance // Return the truly updated balance
    };
  },
});

export const getUserGames = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("games")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc") // Order by creation time, newest first
      .take(50); // Limit to the last 50 games for performance
  },
});
