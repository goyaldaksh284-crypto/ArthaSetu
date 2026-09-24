import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "@/services/api";
import type { User as ApiUser, Transaction as ApiTransaction, Recommendation as ApiRecommendation } from "@/services/api";
import db, { getLocal } from "@/services/database";
import { supabase } from "@/lib/supabase";

export interface User extends ApiUser {
  balance: number;
  avatar_url?: string;
}

export interface Transaction {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  time: string;
  date: string;
  description?: string;
}

export interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low" | "High" | "Medium" | "Low" | "Alert" | "Opportunity";
  title: string;
  description: string;
  reason?: string;
  status?: "pending" | "accepted" | "later";
  impact?: number;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, "id">) => Promise<void>;
  recommendations: Recommendation[];
  updateRecommendationStatus: (id: string, status: "accepted" | "later") => void;
  dailyGoal: number;
  goalProgress: number;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (phone_number: string, password?: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};

const DEMO_USER: User = {
  id: "usr-demo-101",
  email: "rahul.sharma@arthasetu.app",
  name: "Rahul Sharma",
  phone: "9876543210",
  occupation: "Delivery Partner (Swiggy / Zomato)",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  balance: 14850,
};

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "tx-1", type: "income", category: "Swiggy", amount: 1500, time: "14:30", date: new Date().toISOString().split("T")[0], description: "Peak Lunch Shift Payout" },
  { id: "tx-2", type: "expense", category: "Fuel", amount: 250, time: "11:15", date: new Date().toISOString().split("T")[0], description: "Petrol Refuel" },
  { id: "tx-3", type: "expense", category: "Food", amount: 120, time: "13:00", date: new Date().toISOString().split("T")[0], description: "Shift Lunch & Tea" },
  { id: "tx-4", type: "income", category: "Zomato", amount: 1800, time: "21:30", date: new Date(Date.now() - 86400000).toISOString().split("T")[0], description: "Dinner Surge Deliveries" },
  { id: "tx-5", type: "expense", category: "Maintenance", amount: 450, time: "16:45", date: new Date(Date.now() - 86400000).toISOString().split("T")[0], description: "Engine Oil Change" },
  { id: "tx-6", type: "income", category: "Uber", amount: 1100, time: "18:00", date: new Date(Date.now() - 259200000).toISOString().split("T")[0], description: "Weekend City Rides" },
];

const DEMO_RECOMMENDATIONS: Recommendation[] = [
  { id: "rec-1", priority: "High", title: "Build 3-Day Emergency Buffer", description: "Allocate ₹300 from today's safe surplus into your liquid savings to cover vehicle downtime.", reason: "Income volatility is at 28% this week.", status: "pending", impact: 300 },
  { id: "rec-2", priority: "Medium", title: "Presumptive Tax Reserve", description: "Set aside ₹150 for Section 44ADA tax liability.", reason: "Annual projected gross exceeds standard rebate threshold.", status: "pending", impact: 150 },
  { id: "rec-3", priority: "Low", title: "Smart Fuel Optimization", description: "Your fuel expenses accounted for 16% of total revenue yesterday. Plan route clusters.", status: "pending", impact: 120 }
];

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => {
    const savedId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;
    if (savedId) {
      const localProfile = getLocal<any>(`arthasetu_profile_${savedId}`, null);
      if (localProfile) {
        return {
          id: localProfile.user_id || savedId,
          name: localProfile.full_name || 'User',
          email: localProfile.email || '',
          phone: localProfile.phone_number || '',
          avatar_url: localProfile.avatar_url || '',
          balance: 14850,
          created_at: localProfile.created_at || new Date().toISOString(),
          updated_at: localProfile.updated_at || new Date().toISOString(),
          occupation: localProfile.occupation || 'Delivery Partner',
        };
      }
    }
    return DEMO_USER;
  });
  const [transactions, setTransactions] = useState<Transaction[]>(DEMO_TRANSACTIONS);
  const [recommendations, setRecommendations] = useState<Recommendation[]>(DEMO_RECOMMENDATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return Boolean(
      localStorage.getItem('auth_token') ||
      localStorage.getItem('user_id') ||
      localStorage.getItem('arthasetu_supabase_auth_token')
    );
  });

  // Load user profile and transactions using resilient database service
  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const userId = localStorage.getItem('user_id') || 'usr-demo-101';
      localStorage.setItem('user_id', userId);

      // Get user data directly from database service with fallback
      const userData = await db.users.getMe().catch(() => ({
        user_id: DEMO_USER.id,
        email: DEMO_USER.email,
        full_name: DEMO_USER.name,
        phone_number: DEMO_USER.phone,
        occupation: DEMO_USER.occupation,
        created_at: DEMO_USER.created_at,
        preferred_language: 'en',
        is_active: true,
        kyc_verified: true,
        onboarding_completed: true,
      }));

      // Get transactions directly from database service
      const transactionsData = await db.transactions.getAll().catch(() => []);
      const finalTransactions = transactionsData.length > 0 ? transactionsData : [
        {
          transaction_id: "tx-1",
          user_id: userId,
          transaction_date: new Date().toISOString().split("T")[0],
          transaction_time: "14:30",
          amount: 1500,
          transaction_type: "income" as const,
          category: "Swiggy",
          description: "Peak Lunch Shift Payout",
          verified: true,
          is_recurring: false,
          created_at: new Date().toISOString()
        },
        {
          transaction_id: "tx-2",
          user_id: userId,
          transaction_date: new Date().toISOString().split("T")[0],
          transaction_time: "11:15",
          amount: 250,
          transaction_type: "expense" as const,
          category: "Fuel",
          description: "Petrol Refuel",
          verified: true,
          is_recurring: false,
          created_at: new Date().toISOString()
        },
        {
          transaction_id: "tx-3",
          user_id: userId,
          transaction_date: new Date().toISOString().split("T")[0],
          transaction_time: "13:00",
          amount: 120,
          transaction_type: "expense" as const,
          category: "Food",
          description: "Shift Lunch & Tea",
          verified: true,
          is_recurring: false,
          created_at: new Date().toISOString()
        }
      ];

      // Calculate balance from all transactions
      const balance = finalTransactions.reduce((sum, t) => {
        return sum + (t.transaction_type === "income" ? Number(t.amount) : -Number(t.amount));
      }, 0);

      // Get recommendations
      let recommendationsData: any[] = [];
      try {
        recommendationsData = await db.recommendations.getAll();
      } catch (err) {
        recommendationsData = DEMO_RECOMMENDATIONS;
      }

      setUser({
        id: userData.user_id,
        email: userData.email || (userData.phone_number ? `${userData.phone_number}@users.arthasetu.app` : 'user@arthasetu.app'),
        name: userData.full_name || (userData.user_id === 'usr-demo-101' ? 'Rahul Sharma' : 'User'),
        phone: userData.phone_number || '',
        avatar_url: userData.avatar_url || '',
        occupation: userData.occupation || "Delivery Partner",
        created_at: userData.created_at,
        updated_at: userData.created_at,
        balance: balance || 14850,
      });

      setTransactions(
        finalTransactions.map((t) => ({
          id: t.transaction_id,
          category: t.category || "Other",
          amount: Number(t.amount),
          date: t.transaction_date,
          time: t.transaction_time || new Date().toLocaleTimeString(),
          type: t.transaction_type,
          description: t.description || "",
        }))
      );

      setRecommendations(
        (recommendationsData.length > 0 ? recommendationsData : DEMO_RECOMMENDATIONS).map((r) => ({
          id: r.recommendation_id || r.id,
          title: r.title,
          description: r.description || "",
          priority: (r.priority?.toLowerCase() || "medium") as Recommendation["priority"],
          reason: r.reasoning || "",
          status: (r.status || "pending") as "pending" | "accepted" | "later",
        }))
      );
    } catch (err) {
      console.warn("[ArthaSetu AppContext] Falling back to default demo state:", err);
      setUser(DEMO_USER);
      setTransactions(DEMO_TRANSACTIONS);
      setRecommendations(DEMO_RECOMMENDATIONS);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;

    const handleAuthRedirectAndSession = async () => {
      try {
        setIsLoading(true);

        // 1. Automatically detect PKCE authorization code in URL (e.g. ?code=...)
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          const params = new URLSearchParams(window.location.search);
          const code = params.get('code');
          if (code) {
            try {
              const { data, error } = await supabase.auth.exchangeCodeForSession(code);
              if (!error && data?.session?.user && isSubscribed) {
                await db.users.syncAuthUser(data.session.user);
                localStorage.setItem('user_id', data.session.user.id);
                if (data.session.access_token) {
                  localStorage.setItem('auth_token', data.session.access_token);
                }
                setIsAuthenticated(true);
                await loadUserData();
                // Clean URL query parameters
                window.history.replaceState({}, document.title, window.location.pathname);
                return;
              }
            } catch (pkceErr) {
              console.warn('[ArthaSetu Auth] PKCE exchange error:', pkceErr);
            }
          }
        }

        // 2. Automatically detect Supabase OAuth session from URL hash or storage
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && isSubscribed) {
          await db.users.syncAuthUser(session.user);
          localStorage.setItem('user_id', session.user.id);
          if (session.access_token) {
            localStorage.setItem('auth_token', session.access_token);
          }
          setIsAuthenticated(true);
          await loadUserData();
          // Clean URL hash tokens so user sees clean /dashboard
          if (window.location.hash.includes('access_token=')) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        // 3. Fallback to existing logged in user or demo user
        const existingUserId = localStorage.getItem('user_id') || 'usr-demo-101';
        localStorage.setItem('user_id', existingUserId);
        setIsAuthenticated(true);
        if (isSubscribed) {
          await loadUserData();
        }
      } catch (err) {
        console.warn('[ArthaSetu Auth] Session sync error:', err);
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    handleAuthRedirectAndSession();

    // 4. Real-time auth listener for OAuth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isSubscribed) return;
      if (session?.user) {
        await db.users.syncAuthUser(session.user);
        localStorage.setItem('user_id', session.user.id);
        if (session.access_token) {
          localStorage.setItem('auth_token', session.access_token);
        }
        setIsAuthenticated(true);
        await loadUserData();
        if (window.location.hash.includes('access_token=') || window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setUser(null);
      }
    });

    return () => {
      isSubscribed = false;
      listener?.subscription?.unsubscribe();
    };
  }, [loadUserData]);

  // Calculate daily goal and progress
  const dailyGoal = 500;
  const today = new Date().toISOString().split("T")[0];
  const todayTransactions = transactions.filter((t) => t.date === today);
  const todayIncome = todayTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const todayExpense = todayTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const goalProgress = Math.min(
    Math.max(((todayIncome - todayExpense) / dailyGoal) * 100, 0),
    100
  );

  // Add transaction using db.transactions.create (reliable local persistence)
  const addTransaction = async (transaction: Omit<Transaction, "id">) => {
    try {
      setError(null);
      const newTx = await db.transactions.create({
        amount: Number(transaction.amount),
        category: transaction.category,
        description: transaction.description,
        transaction_type: transaction.type,
        transaction_date: transaction.date,
        transaction_time: transaction.time,
      });

      const mappedTransaction: Transaction = {
        id: newTx.transaction_id,
        category: newTx.category || transaction.category,
        amount: Number(newTx.amount),
        date: newTx.transaction_date,
        time: newTx.transaction_time || transaction.time,
        type: newTx.transaction_type,
        description: newTx.description,
      };

      setTransactions((prev) => [mappedTransaction, ...prev]);

      // Recalculate balance
      const newBalance =
        (user?.balance || 0) +
        (transaction.type === "income" ? Number(transaction.amount) : -Number(transaction.amount));
      setUser(user ? { ...user, balance: newBalance } : null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to add transaction";
      setError(errorMsg);
      throw err;
    }
  };

  // Update recommendation status
  const updateRecommendationStatus = (id: string, status: "accepted" | "later") => {
    setRecommendations((prev) =>
      prev.map((rec) => (rec.id === id ? { ...rec, status } : rec))
    );
    db.recommendations.update(id, { status }).catch(() => {});
  };

  // Login handler
  const login = async (phone_number: string, password?: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const res = await db.auth.login(phone_number, password);
      setIsAuthenticated(true);
      if (res?.user_id) {
        localStorage.setItem('user_id', res.user_id);
      }
      await loadUserData();
      navigate("/dashboard");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Signup handler
  const signup = async (data: any) => {
    try {
      setError(null);
      setIsLoading(true);
      const res = await db.auth.signup(data);
      setIsAuthenticated(true);
      if (res?.user_id) {
        localStorage.setItem('user_id', res.user_id);
      }
      await loadUserData();
      navigate("/dashboard");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Signup failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Google Login handler
  const loginWithGoogle = async () => {
    try {
      setError(null);
      setIsLoading(true);
      const res = await db.auth.signInWithGoogle();
      if (res && 'redirected' in res && res.redirected) {
        return;
      }
      setIsAuthenticated(true);
      if (res?.user) {
        await db.users.syncAuthUser(res.user);
      } else if (res?.user_id) {
        localStorage.setItem('user_id', res.user_id);
      }
      await loadUserData();
      navigate("/dashboard");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Google sign-in failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await supabase.auth.signOut().catch(() => {});
      await db.auth.logout().catch(() => {});
      apiService.auth.logout();
    } catch (e) {}
    localStorage.removeItem('user_id');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('arthasetu_supabase_auth_token');
    setUser(null);
    setIsAuthenticated(false);
    navigate("/login", { replace: true });
  };

  // Refresh data
  const refreshData = async () => {
    await loadUserData();
  };

  const value: AppContextType = {
    user,
    setUser,
    transactions,
    addTransaction,
    recommendations,
    updateRecommendationStatus,
    dailyGoal,
    goalProgress,
    isLoading,
    error,
    isAuthenticated,
    login,
    signup,
    loginWithGoogle,
    logout,
    refreshData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
