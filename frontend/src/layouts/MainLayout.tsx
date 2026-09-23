import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { useSidebar } from "@/contexts/SidebarContext";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
  className?: string;
}

const MainLayout = ({ children, className }: MainLayoutProps) => {
  const { isOpen } = useSidebar();
  
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar - Fixed on desktop, overlay on mobile */}
      <Sidebar />

      {/* Main Content - Adjusted for desktop sidebar */}
      <main className={cn(
        "flex-1 overflow-hidden flex flex-col relative transition-all duration-300",
        isOpen ? "md:ml-[256px]" : "md:ml-[80px]"
      )}>
        {/* Top Bar */}
        <TopBar />

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto relative">
          <div className={cn("p-4 sm:p-6 md:p-10 max-w-7xl mx-auto", className)}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
