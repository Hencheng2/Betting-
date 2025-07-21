import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Toaster, toast } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export default function App() {
  const [currentUser, setCurrentUser] = useState<Id<"users"> | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showLogin, setShowLogin] = useState(true);

  const registerUser = useMutation(api.users.registerUser);
  const getUserByPhone = useQuery(api.users.getUserByPhone, 
    phoneNumber ? { phoneNumber } : "skip"
  );

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.match(/^254\d{9}$/)) {
      toast.error("Please enter a valid Kenyan phone number (254XXXXXXXXX)");
      return;
    }

    try {
      if (getUserByPhone) {
        // User exists, log them in
        setCurrentUser(getUserByPhone._id);
        toast.success("Welcome back!");
      } else {
        // Register new user
        const userId = await registerUser({ 
          phoneNumber, 
          referralCode: referralCode || undefined 
        });
        setCurrentUser(userId);
        toast.success("Welcome! You've received 150 KES bonus!");
      }
    } catch (error) {
      toast.error("Authentication failed. Please try again.");
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-green-600 mb-2">BetPoa</h1>
            <p className="text-gray-600">Kenya's Premier Betting Platform</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="254712345678"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Referral Code (Optional)
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              {getUserByPhone ? "Login" : "Register & Get 150 KES Bonus"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>🎁 New users get 150 KES welcome bonus!</p>
            <p>💰 Refer friends and earn 5 KES each!</p>
          </div>
        </div>
        <Toaster />
      </div>
    );
  }

  return <Dashboard userId={currentUser} />;
}

function Dashboard({ userId }: { userId: Id<"users"> }) {
  const [activeTab, setActiveTab] = useState("home");
  const [gameStake, setGameStake] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [mpesaId, setMpesaId] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawPhone, setWithdrawPhone] = useState("");

  const user = useQuery(api.users.getCurrentUser, { userId });
  const transactions = useQuery(api.transactions.getUserTransactions, { userId });
  const games = useQuery(api.games.getUserGames, { userId });
  
  const playGame = useMutation(api.games.playSpinningGame);
  const processDeposit = useMutation(api.users.processDeposit);
  const processWithdrawal = useMutation(api.transactions.processWithdrawal);

  const handleSpin = async () => {
    if (!user || gameStake > user.balance) {
      toast.error("Insufficient balance!");
      return;
    }

    setIsSpinning(true);
    try {
      const result = await playGame({ userId, stake: gameStake });
      
      setTimeout(() => {
        if (result.result === "win") {
          toast.success(`🎉 You won ${result.winAmount} KES! (${result.multiplier}x)`);
        } else {
          toast.error("Better luck next time!");
        }
        setIsSpinning(false);
      }, 2000);
    } catch (error) {
      toast.error("Game failed. Please try again.");
      setIsSpinning(false);
    }
  };

  const handleDeposit = async () => {
    if (!mpesaId.trim()) {
      toast.error("Please enter M-Pesa transaction ID");
      return;
    }

    try {
      await processDeposit({ userId, mpesaTransactionId: mpesaId });
      toast.success("20 KES added to your account!");
      setShowDepositModal(false);
      setMpesaId("");
    } catch (error) {
      toast.error("Deposit failed. Please try again.");
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount < 10) {
      toast.error("Minimum withdrawal is 10 KES");
      return;
    }

    if (!withdrawPhone.match(/^254\d{9}$/)) {
      toast.error("Please enter a valid phone number");
      return;
    }

    try {
      await processWithdrawal({ 
        userId, 
        amount, 
        phoneNumber: withdrawPhone 
      });
      toast.success("Withdrawal request submitted!");
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setWithdrawPhone("");
    } catch (error: any) {
      toast.error(error.message || "Withdrawal failed");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">BetPoa</h1>
          <div className="text-right">
            <p className="text-sm opacity-90">Balance</p>
            <p className="text-xl font-bold">{user.balance.toFixed(2)} KES</p>
          </div>
        </div>
      </header>

      {/* Status Cards */}
      <div className="p-4 space-y-3">
        {!user.welcomeBonusUnlocked && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded">
            <p className="text-sm font-medium text-yellow-800">
              Welcome Bonus: Win {300 - user.totalWinnings} KES more to unlock withdrawals
            </p>
          </div>
        )}
        
        {!user.hasDeposited && (
          <div className="bg-blue-100 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm font-medium text-blue-800">
              Deposit 20 KES and play once to unlock withdrawals
            </p>
          </div>
        )}

        {user.hasDeposited && !user.hasPlayedAfterDeposit && (
          <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded">
            <p className="text-sm font-medium text-orange-800">
              Play one game (max 10 KES stake) to unlock withdrawals
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="p-4">
        {activeTab === "home" && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setShowDepositModal(true)}
                className="bg-green-600 text-white p-4 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                💰 Deposit
              </button>
              <button
                onClick={() => setShowWithdrawModal(true)}
                disabled={!user.canWithdraw}
                className="bg-blue-600 text-white p-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                💸 Withdraw
              </button>
            </div>

            {/* Spinning Game */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4 text-center">🎰 Spinning Game</h2>
              <p className="text-sm text-gray-600 text-center mb-4">
                Win chance: 0.1% | Multiplier: 100x
              </p>
              
              <div className="text-center mb-6">
                <div className={`w-24 h-24 mx-auto rounded-full border-4 border-green-600 flex items-center justify-center text-3xl ${isSpinning ? 'animate-spin' : ''}`}>
                  🎯
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stake Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={gameStake}
                    onChange={(e) => setGameStake(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max={user.balance}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <button
                  onClick={handleSpin}
                  disabled={isSpinning || gameStake > user.balance}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isSpinning ? "Spinning..." : `Spin for ${gameStake} KES`}
                </button>
              </div>
            </div>

            {/* Referral */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold mb-4">👥 Referral Program</h2>
              <p className="text-sm text-gray-600 mb-4">
                Share your code and earn 5 KES for each friend who joins!
              </p>
              <div className="bg-gray-100 p-4 rounded-lg text-center">
                <p className="text-lg font-mono font-bold">{user.referralCode}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Referrals: {user.totalReferrals}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "transactions" && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">Transaction History</h2>
            </div>
            <div className="divide-y">
              {transactions?.map((tx) => (
                <div key={tx._id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{tx.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx._creationTime).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount} KES
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "games" && (
          <div className="bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b">
              <h2 className="text-xl font-bold">Game History</h2>
            </div>
            <div className="divide-y">
              {games?.map((game) => (
                <div key={game._id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">Spinning Game</p>
                    <p className="text-sm text-gray-500">
                      Stake: {game.stake} KES
                    </p>
                  </div>
                  <div className={`font-bold ${game.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                    {game.result === 'win' ? `+${game.winAmount}` : `-${game.stake}`} KES
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="grid grid-cols-3">
          {[
            { id: "home", label: "Home", icon: "🏠" },
            { id: "transactions", label: "History", icon: "📊" },
            { id: "games", label: "Games", icon: "🎮" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-4 text-center ${
                activeTab === tab.id
                  ? "text-green-600 bg-green-50"
                  : "text-gray-600"
              }`}
            >
              <div className="text-xl">{tab.icon}</div>
              <div className="text-xs font-medium">{tab.label}</div>
            </button>
          ))}
        </div>
      </nav>

      {/* Deposit Modal */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Deposit 20 KES</h3>
            <div className="space-y-4">
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-sm font-medium">Send 20 KES to:</p>
                <p className="text-lg font-bold">Till: 4864614</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  M-Pesa Transaction ID
                </label>
                <input
                  type="text"
                  value={mpesaId}
                  onChange={(e) => setMpesaId(e.target.value)}
                  placeholder="Enter transaction ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Withdraw Funds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (KES)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Minimum 10 KES"
                  min="10"
                  max={user.balance}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={withdrawPhone}
                  onChange={(e) => setWithdrawPhone(e.target.value)}
                  placeholder="254712345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleWithdraw}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
