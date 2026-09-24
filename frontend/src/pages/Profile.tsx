import { useState, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { motion } from "framer-motion";
import db, { getLocal, DEMO_PROFILE, DEMO_USER_PROFILE } from "@/services/database";
import { toast } from "sonner";
import PageIntro from "@/components/PageIntro";
import HelpTooltip from "@/components/HelpTooltip";

const Profile = () => {
  const { user, logout } = useApp();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const getInitialProfileFormData = () => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('user_id') || 'usr-demo-101' : 'usr-demo-101';
    const localUser = getLocal<any>(`arthasetu_profile_${userId}`, DEMO_PROFILE);
    const localProf = getLocal<any>(`arthasetu_user_profile_${userId}`, DEMO_USER_PROFILE);
    return {
      full_name: localUser?.full_name || user?.name || "",
      phone_number: localUser?.phone_number || user?.phone || "",
      email: localUser?.email || user?.email || "",
      avatar_url: localUser?.avatar_url || user?.avatar_url || "",
      date_of_birth: localUser?.date_of_birth || "1995-08-15",
      preferred_language: localUser?.preferred_language || "en",
      occupation: localUser?.occupation || user?.occupation || "Delivery Partner",
      city: localUser?.city || "Bengaluru",
      state: localUser?.state || "Karnataka",
      pin_code: localUser?.pin_code || "560001",
      monthly_income_min: localProf?.monthly_income_min?.toString() || "25000",
      monthly_income_max: localProf?.monthly_income_max?.toString() || "45000",
      monthly_expenses_avg: localProf?.monthly_expenses_avg?.toString() || "18000",
      emergency_fund_target: localProf?.emergency_fund_target?.toString() || "30000",
      current_emergency_fund: localProf?.current_emergency_fund?.toString() || "12500",
      risk_tolerance: localProf?.risk_tolerance || "moderate",
      dependents: localProf?.dependents || 1,
      income_sources: localProf?.income_sources || [],
      debt_obligations: localProf?.debt_obligations || [],
    };
  };

  const [formData, setFormData] = useState(getInitialProfileFormData);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const userId = localStorage.getItem('user_id');
    if (!user && !userId) {
      navigate("/signup");
      return;
    }
    // Load profile if user exists OR if user_id exists (for testing)
    if (user || userId) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const [userData, profileData] = await Promise.all([
        db.users.getMe(),
        db.users.getProfile().catch(() => null),
      ]);
      
      setFormData({
        full_name: userData.full_name || "",
        phone_number: userData.phone_number || "",
        email: userData.email || "",
        avatar_url: userData.avatar_url || "",
        date_of_birth: userData.date_of_birth || "",
        preferred_language: userData.preferred_language || "en",
        occupation: userData.occupation || "",
        city: userData.city || "",
        state: userData.state || "",
        pin_code: userData.pin_code || "",
        monthly_income_min: profileData?.monthly_income_min?.toString() || "",
        monthly_income_max: profileData?.monthly_income_max?.toString() || "",
        monthly_expenses_avg: profileData?.monthly_expenses_avg?.toString() || "",
        emergency_fund_target: profileData?.emergency_fund_target?.toString() || "",
        current_emergency_fund: profileData?.current_emergency_fund?.toString() || "",
        risk_tolerance: profileData?.risk_tolerance || "moderate",
        dependents: profileData?.dependents || 0,
        income_sources: profileData?.income_sources || [],
        debt_obligations: profileData?.debt_obligations || [],
      });
      
      setProfile(profileData);
    } catch (error) {
      console.error("Failed to load profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await Promise.all([
        db.users.updateMe({
          full_name: formData.full_name,
          phone_number: formData.phone_number || undefined,
          email: formData.email || undefined,
          avatar_url: formData.avatar_url || undefined,
          date_of_birth: formData.date_of_birth || undefined,
          preferred_language: formData.preferred_language,
          occupation: formData.occupation,
          city: formData.city,
          state: formData.state,
          pin_code: formData.pin_code,
        }),
        db.users.updateProfile({
          monthly_income_min: formData.monthly_income_min ? parseFloat(formData.monthly_income_min) : undefined,
          monthly_income_max: formData.monthly_income_max ? parseFloat(formData.monthly_income_max) : undefined,
          monthly_expenses_avg: formData.monthly_expenses_avg ? parseFloat(formData.monthly_expenses_avg) : undefined,
          emergency_fund_target: formData.emergency_fund_target ? parseFloat(formData.emergency_fund_target) : undefined,
          current_emergency_fund: formData.current_emergency_fund ? parseFloat(formData.current_emergency_fund) : undefined,
          risk_tolerance: formData.risk_tolerance as any,
          dependents: formData.dependents,
          income_sources: formData.income_sources,
          debt_obligations: formData.debt_obligations,
        }),
      ]);
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordForm.current_password || !passwordForm.new_password) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords don't match");
      return;
    }

    try {
      setIsChangingPassword(true);
      await db.auth.changePassword(
        formData.phone_number,
        passwordForm.current_password,
        passwordForm.new_password
      );
      toast.success("Password changed successfully!");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error: any) {
      toast.error(error?.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading && !formData.full_name) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/dashboard")} title="Back to Home">
            <Home className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Profile</h1>
            <p className="text-muted-foreground">Manage your personal and financial information</p>
          </div>
          </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
          </div>

      <PageIntro
        title="What is this page?"
        description="This page stores your personal and financial details, like income range, expenses, dependents, and linked bank accounts."
      />

      {/* Basic Info */}
      <Card className="p-6">
        {/* Profile Identity Banner */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 shadow-sm bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {formData.avatar_url ? (
              <img
                src={formData.avatar_url}
                alt={formData.full_name || "Profile"}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            ) : (
              <span>{formData.full_name?.charAt(0).toUpperCase() || "U"}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xl font-bold text-foreground truncate">{formData.full_name || "User"}</h4>
            <p className="text-sm text-muted-foreground truncate">{formData.email || formData.phone_number}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Active Profile
              </span>
              {formData.avatar_url && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Google Account Connected
                </span>
              )}
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Phone Number</Label>
            <Input
              value={formData.phone_number}
              placeholder="+91 9876543210"
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              disabled={Boolean(formData.phone_number && !formData.phone_number.startsWith('g_'))}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            </div>
          <div className="space-y-2">
            <Label>Date of Birth</Label>
            <Input
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
            />
                </div>
          <div className="space-y-2">
            <Label>Preferred Language</Label>
            <Select
              value={formData.preferred_language}
              onValueChange={(v) => setFormData({ ...formData, preferred_language: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="mr">Marathi</SelectItem>
                <SelectItem value="bn">Bengali</SelectItem>
                <SelectItem value="ta">Tamil</SelectItem>
              </SelectContent>
            </Select>
              </div>
          <div className="space-y-2">
            <Label>Occupation</Label>
            <Input
              value={formData.occupation}
              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
            />
                </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
              </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
                </div>
          <div className="space-y-2">
            <Label>PIN Code</Label>
            <Input
              value={formData.pin_code}
              onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
            />
              </div>
            </div>
          </Card>

      {/* Financial Profile */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Financial Profile</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Monthly Income (Min)</Label>
            <Input
              type="number"
              value={formData.monthly_income_min}
              onChange={(e) => setFormData({ ...formData, monthly_income_min: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Monthly Income (Max)</Label>
            <Input
              type="number"
              value={formData.monthly_income_max}
              onChange={(e) => setFormData({ ...formData, monthly_income_max: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Average Monthly Expenses</Label>
            <Input
              type="number"
              value={formData.monthly_expenses_avg}
              onChange={(e) => setFormData({ ...formData, monthly_expenses_avg: e.target.value })}
            />
              </div>
          <div className="space-y-2">
            <Label>Emergency Fund Target</Label>
            <Input
              type="number"
              value={formData.emergency_fund_target}
              onChange={(e) => setFormData({ ...formData, emergency_fund_target: e.target.value })}
            />
              </div>
          <div className="space-y-2">
            <Label>Current Emergency Fund</Label>
            <Input
              type="number"
              value={formData.current_emergency_fund}
              onChange={(e) => setFormData({ ...formData, current_emergency_fund: e.target.value })}
            />
            </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Risk Tolerance</Label>
              <HelpTooltip text="How comfortable you are with taking financial risk: low, moderate, or high." />
              </div>
            <Select
              value={formData.risk_tolerance}
              onValueChange={(v) => setFormData({ ...formData, risk_tolerance: v })}
            >
              <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Dependents</Label>
              <HelpTooltip text="Number of people who depend on your income, like family members." />
            </div>
            <Input
              type="number"
              value={formData.dependents}
              onChange={(e) => setFormData({ ...formData, dependents: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Security</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={passwordForm.current_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
            />
          </div>
          <Button type="submit" variant="outline" disabled={isChangingPassword}>
            {isChangingPassword ? "Changing..." : "Change Password"}
          </Button>
        </form>
          </Card>

      {/* Logout */}
      <Card className="p-6">
          <Button
          variant="destructive"
          className="w-full"
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
            Logout
          </Button>
      </Card>
    </div>
  );
};

export default Profile;
