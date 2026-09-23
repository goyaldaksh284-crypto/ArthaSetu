import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Brain, TrendingUp, Shield, Zap, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useApp();
  const [activeTab, setActiveTab] = useState<"login" | "signup">(
    location.pathname === "/signup" ? "signup" : "login"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [loginData, setLoginData] = useState({
    phone_number: "9876543210",
    password: "password123",
  });

  const [signupData, setSignupData] = useState({
    full_name: "",
    phone_number: "",
    email: "",
    password: "",
    confirm_password: "",
    preferred_language: "en",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.phone_number) {
      toast.error("Please enter a 10-digit phone number");
      return;
    }
    try {
      setIsLoading(true);
      await login(loginData.phone_number, loginData.password);
      toast.success("Login successful! Welcome to ArthaSetu.");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Login failed";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      setIsLoading(true);
      setLoginData({ phone_number: "9876543210", password: "password123" });
      await login("9876543210", "password123");
      toast.success("Welcome back, Rahul Sharma!");
    } catch (error) {
      toast.error("Demo login error: " + (error instanceof Error ? error.message : ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.full_name || !signupData.phone_number || !signupData.password) {
      toast.error("Please fill all required fields");
      return;
    }
    if (signupData.password !== signupData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (signupData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      setIsLoading(true);
      await signup({
        full_name: signupData.full_name,
        phone_number: signupData.phone_number,
        email: signupData.email || undefined,
        password: signupData.password,
        occupation: "Gig Delivery Partner",
        city: "Bengaluru",
      });
      toast.success("Account created successfully! Welcome to ArthaSetu.");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Signup failed";
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    { icon: Brain, text: "AI Financial Health & Insights" },
    { icon: TrendingUp, text: "Smart Gig Income Forecasting" },
    { icon: Shield, text: "Privacy-First Data Protection" },
    { icon: Zap, text: "1-Click Expense & Tax Optimization" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center p-4 pt-20">
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left: Brand Explanation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden md:block space-y-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-4">
              <Sparkles size={14} /> Bharat's Gig Worker Companion
            </div>
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center p-2 shadow-lg border border-slate-800 flex-shrink-0">
                <img src="/arthasetu-logo.png" alt="ArthaSetu Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                ArthaSetu
              </h1>
            </div>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Your smart financial bridge for daily earnings. Managing volatility, taxes, and micro-savings for delivery partners and gig freelancers.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map(({ icon: Icon, text }, index) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="bg-white rounded-xl p-4 shadow-sm border border-slate-200"
              >
                <Icon className="w-6 h-6 text-slate-700 mb-2" />
                <p className="text-sm font-medium text-slate-900">{text}</p>
              </motion.div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-slate-200 text-sm flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Instant Demo Mode Active</p>
              <p className="text-xs text-slate-400">Experience all features with preloaded realistic transactions</p>
            </div>
            <Button
              size="sm"
              onClick={handleDemoLogin}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              ⚡ Quick Demo
            </Button>
          </div>
        </motion.div>

        {/* Right: Auth Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8">
            {/* Mobile Brand Header */}
            <div className="md:hidden flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center p-1.5 shadow-md border border-slate-800 flex-shrink-0">
                <img src="/arthasetu-logo.png" alt="ArthaSetu" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">ArthaSetu</h2>
                <p className="text-xs text-muted-foreground">Financial Companion</p>
              </div>
            </div>

            {/* Quick Demo Banner for Mobile / Quick Access */}
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-900">Testing the app?</p>
                <p className="text-[11px] text-emerald-700">1-click login as Rahul Sharma</p>
              </div>
              <Button
                size="sm"
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
              >
                ⚡ Quick Demo Login
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1 text-slate-900">Welcome to ArthaSetu</h2>
                  <p className="text-sm text-muted-foreground">Login with your mobile number to access your dashboard</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-phone">Mobile Number</Label>
                    <Input
                      id="login-phone"
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      value={loginData.phone_number}
                      onChange={(e) =>
                        setLoginData({ ...loginData, phone_number: e.target.value.replace(/\D/g, "").slice(0, 10) })
                      }
                      disabled={isLoading}
                      autoComplete="tel"
                    />
                    <p className="text-[11px] text-slate-500">Demo Phone: 9876543210 or enter your own 10-digit number</p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="login-password">Password</Label>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked === true)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      Remember this device
                    </Label>
                  </div>

                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        Login to ArthaSetu
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Signup Tab */}
              <TabsContent value="signup" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1 text-slate-900">Create your ArthaSetu Account</h2>
                  <p className="text-sm text-muted-foreground">Start managing your daily income, taxes and savings</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="Rahul Sharma"
                      value={signupData.full_name}
                      onChange={(e) => setSignupData({ ...signupData, full_name: e.target.value })}
                      disabled={isLoading}
                      autoComplete="name"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-phone">Mobile Number (10 digits) *</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="9876543210"
                      maxLength={10}
                      value={signupData.phone_number}
                      onChange={(e) =>
                        setSignupData({ ...signupData, phone_number: e.target.value.replace(/\D/g, "").slice(0, 10) })
                      }
                      disabled={isLoading}
                      autoComplete="tel"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-email">Email (Optional)</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="partner@example.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-password">Password (min 6 characters) *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-confirm">Confirm Password *</Label>
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.confirm_password}
                      onChange={(e) => setSignupData({ ...signupData, confirm_password: e.target.value })}
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-language">Preferred Language</Label>
                    <Select
                      value={signupData.preferred_language}
                      onValueChange={(v) => setSignupData({ ...signupData, preferred_language: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                        <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                        <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
                        <SelectItem value="kn">ಕನ್ನಡ (Kannada)</SelectItem>
                        <SelectItem value="mr">मराठी (Marathi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white mt-2" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
