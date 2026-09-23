import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/contexts/AppContext";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: "9876543210",
    password: "password123",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.phone_number || !formData.password) {
      toast.error("Please fill all fields");
      return;
    }

    if (formData.phone_number.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }

    try {
      setIsLoading(true);
      await login(formData.phone_number, formData.password);
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
      setFormData({ phone_number: "9876543210", password: "password123" });
      await login("9876543210", "password123");
      toast.success("Welcome back, Rahul Sharma!");
    } catch (error) {
      toast.error("Demo login error: " + (error instanceof Error ? error.message : ""));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-card rounded-3xl shadow-xl border border-border p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center p-1.5 shadow-md border border-slate-800 flex-shrink-0">
                  <img src="/arthasetu-logo.png" alt="ArthaSetu" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground">ArthaSetu</h1>
                  <p className="text-xs text-muted-foreground">Financial Companion</p>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-1">Welcome back!</h2>
              <p className="text-sm text-muted-foreground">Login to your ArthaSetu account</p>
            </div>

            {/* Quick Demo Access */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">Want to test quickly?</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">1-click demo login (Rahul Sharma)</p>
              </div>
              <Button
                size="sm"
                type="button"
                onClick={handleDemoLogin}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3"
              >
                ⚡ Demo Login
              </Button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="9876543210"
                  maxLength={10}
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  disabled={isLoading}
                />
                <p className="text-[11px] text-muted-foreground">Demo Phone: 9876543210 or your mobile number</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">or</span>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <button
                onClick={() => navigate("/signup")}
                className="text-primary hover:underline font-medium"
              >
                Sign up here
              </button>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
