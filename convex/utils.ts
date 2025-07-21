// convex/utils.ts

/**
 * Generates a random alphanumeric referral code.
 * @param length The desired length of the referral code.
 * @returns A string representing the referral code.
 */
export function generateReferralCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
