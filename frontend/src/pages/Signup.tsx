import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const Signup = () => {
  const navigate = useNavigate();
  const { signup, loginWithGoogle } = useApp();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    phone_number: "",
    occupation: "",
    city: "",
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.email || !formData.email.includes("@")) {
        toast.error("Please enter a valid email");
        return;
      }
      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
    }
    if (step === 2) {
      if (!formData.full_name || !formData.phone_number) {
        toast.error("Please fill all fields");
        return;
      }
      if (formData.phone_number.length !== 10) {
        toast.error("Please enter a valid 10-digit phone number");
        return;
      }
    }
    if (step < 3) setStep(step + 1);
  };

  const handleComplete = async () => {
    if (!formData.occupation || !formData.city) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      setIsSubmitting(true);

      await signup({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone_number: formData.phone_number,
        occupation: formData.occupation,
        city: formData.city,
      });

      toast.success(`Welcome ${formData.full_name}! 🎉`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Signup failed";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
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
          {/* Progress Bar */}
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
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
                  <h2 className="text-2xl font-bold mb-1">Let's get started</h2>
                  <p className="text-muted-foreground mb-4">Create your ArthaSetu account</p>

                  <GoogleSignInButton
                    onClick={async () => {
                      try {
                        setIsGoogleLoading(true);
                        await loginWithGoogle();
                        toast.success("Welcome to ArthaSetu!");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Google sign-in failed");
                      } finally {
                        setIsGoogleLoading(false);
                      }
                    }}
                    isLoading={isGoogleLoading}
                    disabled={isSubmitting}
                  />

                  <div className="relative my-4 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider">
                      <span className="bg-card px-3 text-muted-foreground font-medium">
                        or register with email
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      placeholder="At least 6 characters"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Tell us about you</h2>
                  <p className="text-muted-foreground">Help us personalize your experience</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      placeholder="Rajesh Kumar"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      type="tel"
                      placeholder="9876543210"
                      value={formData.phone_number}
                      onChange={(e) =>
                        setFormData({ ...formData, phone_number: e.target.value.slice(0, 10) })
                      }
                      maxLength={10}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-2xl font-bold mb-2">Additional information</h2>
                  <p className="text-muted-foreground">This helps us give better recommendations</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Occupation</Label>
                    <Select value={formData.occupation} onValueChange={(v) => setFormData({ ...formData, occupation: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select occupation" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Uber Driver">Uber Driver</SelectItem>
                        <SelectItem value="Ola Driver">Ola Driver</SelectItem>
                        <SelectItem value="Swiggy Partner">Swiggy Partner</SelectItem>
                        <SelectItem value="Zomato Partner">Zomato Partner</SelectItem>
                        <SelectItem value="Freelancer">Freelancer</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input
                      placeholder="e.g., Mumbai, Delhi, Bangalore"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <Button 
                variant="outline" 
                onClick={() => setStep(step - 1)} 
                className="flex-1"
                disabled={isSubmitting}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            {step < 3 ? (
              <Button 
                onClick={handleNext} 
                className="flex-1 bg-primary"
                disabled={isSubmitting}
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete} 
                className="flex-1 bg-gradient-to-r from-primary to-secondary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  "Start Using Agente AI"
                )}
              </Button>
            )}
          </div>

          {/* Already have account link */}
          {step === 1 && (
            <p className="text-center text-sm text-muted-foreground mt-6">
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-primary hover:underline"
              >
                Login here
              </button>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
