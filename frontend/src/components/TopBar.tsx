import { useNavigate, useLocation } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Menu, X } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Home",
  "/transactions": "Transactions",
  "/tips": "Tips",
  "/stats": "Stats",
  "/budget": "Budget",
  "/risk": "Risk Analysis",
  "/actions": "Action Plan",
  "/goals": "Goals",
  "/savings": "Savings",
  "/tax": "Tax",
  "/benefits": "Benefits",
  "/profile": "Profile",
};

const TopBar = () => {
  const location = useLocation();
  const { user, logout } = useApp();
  const { isOpen, toggle } = useSidebar();
  const navigate = useNavigate();

  const currentPageTitle = pageTitles[location.pathname] || "ArthaSetu";

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/40">
      <div className="flex items-center px-4 md:px-10 h-[56px]">
        {/* Left: Toggle Button */}
        <div className="flex items-center">
          {/* Mobile Toggle Button (opens the drawer on phones) */}
          <button
            onClick={toggle}
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 rounded-[4px] hover:bg-muted/60 transition-colors"
            title="Open menu"
          >
            <Menu size={20} className="text-muted-foreground" />
          </button>
          {/* Desktop Toggle Button */}
          <button
            onClick={toggle}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-[4px] hover:bg-muted/60 transition-colors"
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isOpen ? <X size={18} className="text-muted-foreground" /> : <Menu size={18} className="text-muted-foreground" />}
          </button>
        </div>

        {/* Center: Page Title */}
        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-[18px] font-semibold tracking-tight text-foreground">{currentPageTitle}</h1>
        </div>

        {/* Right: User Avatar + Logout */}
        <div className="flex items-center gap-2">
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 h-auto px-2 py-1.5 rounded-full hover:bg-muted/60 transition-colors">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-[13px] border border-slate-200/80 shadow-sm flex-shrink-0">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.name || "User"}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{user.name?.charAt(0).toUpperCase() || "U"}</span>
                    )}
                  </div>
                  <span className="hidden md:block text-[13px] font-medium text-foreground">{user.name || "User"}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email || user.phone}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;

