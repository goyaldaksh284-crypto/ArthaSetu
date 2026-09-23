import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  setIsOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpenState] = useState(() => {
    if (typeof window !== "undefined") {
      // Phones/tablets in portrait always start with the drawer closed so it
      // never covers the page on load. The desktop rail preference is
      // persisted separately (a stale "open" from a laptop session used to
      // force the drawer open on phones).
      if (window.innerWidth < 768) return false;
      const saved = localStorage.getItem("sidebar_open");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  // Persist only the desktop preference; mobile ignores it on load.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      localStorage.setItem("sidebar_open", String(isOpen));
    }
  }, [isOpen]);

  // Crossing down into mobile always closes the overlay drawer; the desktop
  // rail state is left untouched.
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsOpenState(false);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    setIsOpenState((prev) => !prev);
  };

  const setIsOpen = (open: boolean) => {
    setIsOpenState(open);
  };

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, setIsOpen }}>
      {children}
    </SidebarContext.Provider>
  );
};
