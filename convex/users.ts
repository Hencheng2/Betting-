// convex/users.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel"; // Ensure Id type is imported
import { generateReferralCode } from './utils'; // Import helper for referral code

export const registerUser = mutation({
  args: {
    phoneNumber: v.string(),
    referralCode: v.optional(v.string()), // Optional referral code input
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existingUser) {
      // This mutation is for *new* users. If user exists, frontend handles as login.
      // So, if we reach here, it's an unexpected state or a re-registration attempt.
      throw new Error("User with this phone number already exists.");
    }

    let referredById: Id<"users"> | undefined = undefined;
    if (args.referralCode) {
      const referrer = await ctx.db
        .query("users")
        .withIndex("by_referral_code", (q) =>
          q.eq("referralCode", args.referralCode!)
        )
        .first();

      if (referrer) {
        referredById = referrer._id;
        // Increment referrer's totalReferrals and add referral bonus
        await ctx.db.patch(referrer._id, {
          totalReferrals: referrer.totalReferrals + 1,
          balance: referrer.balance + 5, // 5 KES referral bonus
        });
        // Record referral bonus transaction for referrer
        await ctx.db.insert("transactions", {
          userId: referrer._id,
          type: "referral",
          amount: 5,
          status: "completed",
          description: `Referral bonus from ${args.phoneNumber}`,
        });
        // Consider also adding a 'referrals' table entry if needed for detailed tracking.
        await ctx.db.insert("referrals", {
            referrerId: referrer._id,
            referredUserId: userId, // userId will be defined below
            bonusAwarded: true,
        });
      }
    }

    // Generate unique referral code for the new user
    let newReferralCode: string;
    let codeExists = true;
    while(codeExists) {
        newReferralCode = generateReferralCode(6); // Generate a 6-character code
        const existingCode = await ctx.db
            .query("users")
            .withIndex("by_referral_code", (q) => q.eq("referralCode", newReferralCode))
            .first();
        codeExists = !!existingCode; // Check if the generated code already exists
    }


    // Create the new user
    const userId = await ctx.db.insert("users", {
      phoneNumber: args.phoneNumber,
      balance: 150, // 150 KES welcome bonus
      welcomeBonusUnlocked: false, // Initial state
      totalWinnings: 0,
      hasDeposited: false, // Initial state
      hasPlayedAfterDeposit: false, // Initial state
      canWithdraw: false, // Initial state: cannot withdraw until conditions met
      referralCode: newReferralCode,
      referredBy: referredById, // Set if a valid referrer was found
      totalReferrals: 0, // New user starts with 0 referrals
    });

    // Record welcome bonus transaction for the new user
    await ctx.db.insert("transactions", {
      userId: userId,
      type: "bonus",
      amount: 150,
      status: "completed",
      description: "Welcome bonus",
    });

    return userId; // Return the ID of the newly created user
  },
});

export const getUserByPhone = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    // This query is used by the frontend to check if a user exists
    // for login vs. registration flow.
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();
  },
});

export const getCurrentUser = query({
  args: { userId: v.id("users") }, // Expects the userId from the frontend state (e.g., localStorage)
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      // If user not found (e.g., invalid ID or deleted), throw error to prompt re-auth
      throw new Error("User not found or session invalid.");
    }
    return user;
  },
});

export const processDeposit = mutation({
  args: {
    userId: v.id("users"),
    mpesaTransactionId: v.string(), // This ID is provided by the user and is NOT verified here
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found.");
    }

    // Add 20 KES to balance unconditionally as per requirement
    const newBalance = user.balance + 20;

    // Update user state for deposit-related withdrawal conditions
    await ctx.db.patch(args.userId, {
      balance: newBalance,
      hasDeposited: true, // Mark that they have made the special 20 KES deposit
      // Note: canWithdraw is NOT set to true here. It requires playing a game
      // with amounts of up to 10 KES AFTER this deposit, which is handled in games.ts.
    });

    // Record the deposit transaction
    await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: 20,
      status: "completed", // Status is completed because the balance is immediately updated
      mpesaTransactionId: args.mpesaTransactionId, // Store the provided ID for audit
      description: `Deposit (M-Pesa ID: ${args.mpesaTransactionId})`,
    });

    return { success: true, newBalance };
  },
});
