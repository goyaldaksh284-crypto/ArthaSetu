import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BarChart3,
  Lightbulb,
  Wallet,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  User,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  Award,
  Target,
  PiggyBank,
} from "lucide-react";
import { cn } from "@/lib/utils";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useApp();
  const { isOpen, setIsOpen } = useSidebar();

  const menuItems = [
    {
      label: "Home",
      icon: LayoutDashboard,
      path: "/dashboard",
      description: "Overview",
      color: "from-slate-600 to-slate-700",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      label: "Transactions",
      icon: BarChart3,
      path: "/transactions",
      description: "All Transactions",
      color: "from-slate-500 to-slate-600",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      label: "Tips",
      icon: Lightbulb,
      path: "/tips",
      description: "Recommendations",
      color: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      label: "Stats",
      icon: BarChart3,
      path: "/stats",
      description: "Analytics",
      color: "from-slate-600 to-slate-700",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      label: "Budget",
      icon: Wallet,
      path: "/budget",
      description: "Budgeting",
      color: "from-slate-500 to-slate-600",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      label: "Risk Analysis",
      icon: AlertCircle,
      path: "/risk",
      description: "Risk Management",
      color: "from-red-500 to-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
    {
      label: "Action Plan",
      icon: CheckCircle,
      path: "/actions",
      description: "Financial Goals",
      color: "from-slate-600 to-slate-700",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      label: "Goals",
      icon: Target,
      path: "/goals",
      description: "Financial Goals",
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "Savings",
      icon: PiggyBank,
      path: "/savings",
      description: "Savings & Investments",
      color: "from-green-500 to-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      label: "Tax",
      icon: TrendingUp,
      path: "/tax",
      description: "Tax Analysis",
      color: "from-slate-500 to-slate-600",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
    {
      label: "Benefits",
      icon: Award,
      path: "/benefits",
      description: "Government Schemes",
      color: "from-emerald-500 to-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      label: "Profile",
      icon: User,
      path: "/profile",
      description: "Account",
      color: "from-slate-600 to-slate-700",
      bgColor: "bg-slate-50 dark:bg-slate-950",
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      {/* Sidebar - Desktop sticky (rail when collapsed), Mobile overlay drawer.
          Driven purely by CSS classes so the md: breakpoints behave:
            open            -> 256px drawer/rail
            closed desktop  -> 80px icon rail
            closed mobile   -> off-screen                            */}
      <div
        className={cn(
          "fixed left-0 top-0 h-screen bg-background border-r border-border/40 backdrop-blur-sm transition-all duration-300 z-40 shadow-[0_0_1px_0_rgba(0,0,0,0.1)] flex flex-col overflow-hidden",
          isOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full md:translate-x-0 md:w-20"
        )}
      >
        {/* Logo Section */}
        <div className="px-4 py-3.5 border-b border-border/30 relative">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsOpen(false);
              }
              navigate("/");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2.5 text-left group transition-opacity hover:opacity-80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
            title="Go to Landing Page"
            aria-label="ArthaSetu Home"
          >
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center p-1 flex-shrink-0 shadow-sm border border-slate-800 group-hover:scale-105 transition-transform">
              <img src="/arthasetu-logo.png" alt="ArthaSetu Logo" className="w-full h-full object-contain" />
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-[15px] font-bold tracking-tight text-foreground whitespace-nowrap group-hover:text-primary transition-colors">
                  ArthaSetu
                </p>
                <p className="text-[11px] text-muted-foreground whitespace-nowrap">Financial Companion</p>
              </div>
            )}
          </button>
          
          {/* Mobile close button (drawer overlays the TopBar on phones) */}
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden absolute top-1/2 -translate-y-1/2 right-3 w-8 h-8 flex items-center justify-center rounded-[4px] hover:bg-muted/60 transition-colors"
            title="Close menu"
          >
            <X size={18} className="text-muted-foreground" />
          </button>

          {/* Desktop Toggle Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex absolute top-1/2 -right-2.5 transform -translate-y-1/2 w-5 h-5 rounded-[3px] bg-background border border-border/60 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)] hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.1)] items-center justify-center z-50 transition-all"
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? (
              <ChevronLeft size={12} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={12} className="text-muted-foreground" />
            )}
          </button>
              </div>


        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                  onClick={() => {
                    navigate(item.path);
                  // Only close on mobile
                  if (window.innerWidth < 768) {
                    setIsOpen(false);
                  }
                  }}
                  className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[4px] transition-colors group relative",
                    active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  !isOpen && "justify-center"
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {isOpen && (
                  <div className="flex-1 text-left overflow-hidden min-w-0">
                    <p className="text-[13px] font-medium whitespace-nowrap truncate">{item.label}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default Sidebar;
