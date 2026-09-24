/**
 * API Service Layer
 * Centralized API client for all backend communication
 * Handles authentication, error handling, and typed responses
 */

import spareBackendService from "./spareBackend";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id?: string;
  user?: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  age?: number;
  monthly_income?: number;
  occupation?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  category: string;
  description?: string;
  type: "income" | "expense";
  date: string;
  time: string;
  created_at: string;
}

export interface AnalysisResult {
  patterns: Pattern[];
  recommendations: Recommendation[];
  summary: string;
}

export interface Pattern {
  id: string;
  category: string;
  average_amount: number;
  frequency: string;
  trend: "increasing" | "decreasing" | "stable";
  confidence: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  impact: number;
  category: string;
  action_url?: string;
}

export interface BudgetAnalysis {
  total_income: number;
  total_expense: number;
  remaining_balance: number;
  category_breakdown: CategoryBudget[];
  savings_rate: number;
  alert?: string;
}

export interface CategoryBudget {
  category: string;
  allocated: number;
  spent: number;
  remaining: number;
  percentage_used: number;
}

export interface Forecast {
  next_30_days: DailyForecast[];
  projected_balance: number;
  trend: "improving" | "declining" | "stable";
  alerts: string[];
}

export interface DailyForecast {
  date: string;
  predicted_balance: number;
  confidence: number;
}

export interface TaxAnalysis {
  estimated_tax: number;
  taxable_income: number;
  deductions_available: string[];
  tax_rate: number;
  savings_opportunities: string[];
}

export interface ITRForm {
  form_type: string;
  sections: FormSection[];
  estimated_tax: number;
  filing_deadline: string;
}

export interface FormSection {
  title: string;
  fields: FormField[];
}

export interface FormField {
  label: string;
  value: string | number;
  editable: boolean;
}

export interface ContextIntelligence {
  current_financial_health: string;
  key_insights: string[];
  financial_goals_aligned: boolean;
  next_steps: string[];
}

export interface KnowledgeIntegration {
  relevant_schemes: Scheme[];
  learning_resources: Resource[];
  personalized_tips: string[];
}

export interface Scheme {
  name: string;
  description: string;
  eligibility: string;
  benefits: string;
  application_url: string;
}

export interface Resource {
  title: string;
  description: string;
  url: string;
  type: string;
}

export interface RiskAssessment {
  risk_level: "low" | "medium" | "high";
  risk_factors: RiskFactor[];
  mitigation_strategies: string[];
  emergency_fund_status: string;
}

export interface RiskFactor {
  factor: string;
  severity: number;
  impact: string;
  recommendation: string;
}

export interface ActionExecution {
  recommended_actions: Action[];
  priority_order: string[];
  expected_impact: string;
}

export interface Action {
  id: string;
  title: string;
  description: string;
  priority: number;
  deadline?: string;
  estimated_impact: string;
  status: "pending" | "in_progress" | "completed";
}

export interface ContinuousLearning {
  session_id: string;
  key_learnings: string[];
  improvement_areas: string[];
  next_learning_topics: string[];
  success_metrics: string[];
}

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

export class TokenManager {
  private static readonly TOKEN_KEY = "auth_token";
  private static readonly USER_KEY = "auth_user";

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  static removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static getUser(): User | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }

  static setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static removeUser(): void {
    localStorage.removeItem(this.USER_KEY);
  }

  static clear(): void {
    this.removeToken();
    this.removeUser();
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const token = TokenManager.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    console.log(`[API] ${options.method || "GET"} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Check content type before parsing JSON
    const contentType = response.headers.get("content-type");
    let data: any;
    
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (e) {
        // If JSON parsing fails, use response text
        const text = await response.text();
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    } else {
      // For non-JSON responses, get text
      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `HTTP error! status: ${response.status}`);
      }
      // Try to parse as JSON if text looks like JSON
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (response.status === 401) {
      TokenManager.clear();
      window.location.href = "/signup";
      throw new Error("Unauthorized: Please login again");
    }

    if (!response.ok) {
      console.error(`[API ERROR] ${endpoint}:`, data);
      throw new Error(data.detail || data.message || `HTTP error! status: ${response.status}`);
    }

    console.log(`[API SUCCESS] ${endpoint}:`, data);
    return data;
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, body?: Record<string, any>): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: Record<string, any>): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: "DELETE" });
  }
}

// ============================================================================
// API SERVICE - MAIN EXPORT
// ============================================================================

const client = new ApiClient(API_BASE_URL);

export const apiService = {
  // ========== AUTHENTICATION ==========
  auth: {
    signup: async (data: {
      email?: string;
      password: string;
      full_name: string;
      phone_number: string;
      occupation: string;
      city: string;
    }): Promise<AuthResponse> => {
      const response = await client.post<any>("/users/signup", data);
      TokenManager.setToken(response.access_token);

      // Fetch user data after signup
      try {
        const userResponse = await client.get<User>("/users/me");
        TokenManager.setUser(userResponse);

        // Trigger spare backend analysis for new user
        if (userResponse.id) {
          console.log(`[Signup] Triggering spare backend analysis for user ${userResponse.id}`);
          spareBackendService.triggerAnalysis(userResponse.id).catch((error) => {
            console.warn("Could not trigger spare backend analysis:", error);
          });
        }

        return {
          access_token: response.access_token,
          token_type: response.token_type,
          user: userResponse,
        };
      } catch (error) {
        console.warn("Could not fetch user after signup, using basic info", error);
        return {
          access_token: response.access_token,
          token_type: response.token_type,
          user_id: response.user_id,
        };
      }
    },

    login: async (data: {
      phone_number: string;
      password: string;
    }): Promise<AuthResponse> => {
      const response = await client.post<any>("/users/login", data);
      TokenManager.setToken(response.access_token);

      // Fetch user data after login
      try {
        const userResponse = await client.get<User>("/users/me");
        TokenManager.setUser(userResponse);

        // Trigger spare backend analysis on login
        if (userResponse.id) {
          console.log(`[Login] Triggering spare backend analysis for user ${userResponse.id}`);
          spareBackendService.triggerAnalysis(userResponse.id).catch((error) => {
            console.warn("Could not trigger spare backend analysis:", error);
          });
        }

        return {
          access_token: response.access_token,
          token_type: response.token_type,
          user: userResponse,
        };
      } catch (error) {
        console.warn("Could not fetch user after login, using basic info", error);
        return {
          access_token: response.access_token,
          token_type: response.token_type,
          user_id: response.user_id,
        };
      }
    },

    logout: (): void => {
      TokenManager.clear();
    },
  },

  // ========== USER PROFILE ==========
  user: {
    getProfile: async (): Promise<User> => {
      return client.get<User>("/users/me/profile");
    },

    updateProfile: async (data: Partial<User>): Promise<User> => {
      return client.put<User>("/users/me/profile", data);
    },
  },

  // ========== TRANSACTIONS ==========
  transactions: {
    getTransactions: async (
      filters?: Record<string, any>
    ): Promise<Transaction[]> => {
      const query = new URLSearchParams(filters).toString();
      const endpoint = query ? `/users/me/transactions?${query}` : "/users/me/transactions";
      return client.get<Transaction[]>(endpoint);
    },

    addTransaction: async (data: {
      amount: number;
      category: string;
      description?: string;
      type: "income" | "expense";
      date: string;
      time: string;
    }): Promise<Transaction> => {
      return client.post<Transaction>("/users/me/transactions", data);
    },
  },

  // ========== ANALYSIS - PHASE 1 ==========
  analysis: {
    getAnalysis: async (
      includeRecommendations = true
    ): Promise<AnalysisResult> => {
      return client.post<AnalysisResult>("/analysis/", {
        include_recommendations: includeRecommendations
      });
    },

    getRecommendations: async (): Promise<Recommendation[]> => {
      const data = await client.get<any[]>("/analysis/recommendations");
      return data.map((rec) => ({
        id: rec.recommendation_id,
        title: rec.title || "",
        description: rec.description || "",
        priority: (rec.priority || "medium") as "high" | "medium" | "low",
        impact: Math.round((rec.confidence_score || rec.success_probability || 0) * 100),
        category: rec.recommendation_type || "general",
        action_url: rec.action_url,
      }));
    },
  },

  // ========== BUDGET - PHASE 2 ==========
  budget: {
    analyzeBudget: async (): Promise<BudgetAnalysis> => {
      return client.post<BudgetAnalysis>("/analysis/budget", {});
    },
  },

  // ========== FORECAST - PHASE 2 ==========
  forecast: {
    getForecast: async (days?: number): Promise<Forecast> => {
      const endpoint = days ? `/analysis/forecast?days=${days}` : "/analysis/forecast";
      return client.get<Forecast>(endpoint);
    },
  },

  // ========== TAX - PHASE 2 ==========
  tax: {
    analyzeTax: async (): Promise<TaxAnalysis> => {
      return client.post<TaxAnalysis>("/analysis/tax", {});
    },

    generateITRForm: async (): Promise<ITRForm> => {
      return client.post<ITRForm>("/analysis/tax/itr-form", {});
    },
  },

  // ========== CONTEXT INTELLIGENCE - PHASE 3 ==========
  contextIntelligence: {
    getAnalysis: async (): Promise<ContextIntelligence> => {
      return client.post<ContextIntelligence>(
        "/analysis/context-intelligence",
        {}
      );
    },
  },

  // ========== KNOWLEDGE INTEGRATION - PHASE 3 ==========
  knowledgeIntegration: {
    getAnalysis: async (): Promise<KnowledgeIntegration> => {
      return client.post<KnowledgeIntegration>(
        "/analysis/knowledge-integration",
        {}
      );
    },
  },

  // ========== RISK ASSESSMENT - PHASE 3 ==========
  riskAssessment: {
    getAnalysis: async (): Promise<RiskAssessment> => {
      return client.post<RiskAssessment>("/analysis/risk-assessment", {});
    },
  },

  // ========== ACTION EXECUTION - PHASE 3 ==========
  actionExecution: {
    getActions: async (
      actionType: string,
      amount: number,
      userConsent: boolean = false
    ): Promise<ActionExecution> => {
      return client.post<ActionExecution>("/analysis/action-execution", {
        action_type: actionType,
        amount: amount,
        user_consent: userConsent
      });
    },
  },

  // ========== CONTINUOUS LEARNING - PHASE 3 ==========
  continuousLearning: {
    getLearning: async (): Promise<ContinuousLearning> => {
      return client.get<ContinuousLearning>("/analysis/continuous-learning");
    },
  },

  // ========== SPARE BACKEND - 9 AI AGENTS ==========
  spareBackend: spareBackendService,
};

export default apiService;

// Export spare backend separately for direct access
export { spareBackendService };
