import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { Archive, BriefcaseBusiness, ClipboardCheck, LayoutDashboard, LogOut, PanelLeft, SearchCheck, ShieldCheck } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: LayoutDashboard, label: "Control room", path: "/" },
  { icon: BriefcaseBusiness, label: "Capture role", path: "/capture" },
  { icon: ClipboardCheck, label: "Review queue", path: "/queue" },
  { icon: SearchCheck, label: "Search criteria", path: "/criteria" },
  { icon: ShieldCheck, label: "Evidence boundary", path: "/evidence" },
  { icon: Archive, label: "Safety protocol", path: "/safety" },
];

const SIDEBAR_WIDTH_KEY = "opportunity-hub-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 220;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || DEFAULT_WIDTH);
  const { loading, user } = useAuth();

  useEffect(() => localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth)), [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return (
      <div className="blueprint-grid min-h-screen bg-[#061B5A] px-6 text-white flex items-center justify-center">
        <div className="blueprint-panel w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center border border-cyan-200/70 bg-cyan-200/10 text-cyan-100"><ShieldCheck className="h-6 w-6" /></div>
          <p className="eyebrow">PRIVATE WORKSPACE</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in to access your opportunity pipeline.</h1>
          <p className="mt-3 text-sm leading-6 text-blue-100/75">This dashboard is restricted to its owner and does not control any job-site account.</p>
          <Button onClick={() => startLogin()} className="mt-7 w-full rounded-none bg-white text-[#061B5A] hover:bg-cyan-50">Sign in securely</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardContent setSidebarWidth={setSidebarWidth}>{children}</DashboardContent>
    </SidebarProvider>
  );
}

function DashboardContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - left;
      if (nextWidth >= MIN_WIDTH && nextWidth <= MAX_WIDTH) setSidebarWidth(nextWidth);
    };
    const handleUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleUp);
      document.body.style.cursor = "col-resize";
    }
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-0 bg-[#071E63] text-white" disableTransition={isResizing}>
          <SidebarHeader className="h-auto px-3 pb-5 pt-5">
            <div className="flex items-center gap-3 px-1">
              <button onClick={toggleSidebar} className="grid h-8 w-8 place-items-center border border-white/20 bg-white/5 text-white hover:bg-white/10" aria-label="Toggle navigation"><PanelLeft className="h-4 w-4" /></button>
              {!isCollapsed && <div className="min-w-0"><p className="text-[10px] font-semibold tracking-[0.2em] text-cyan-100/80">OPPORTUNITY</p><p className="truncate text-sm font-semibold">CONTROL ROOM</p></div>}
            </div>
            {!isCollapsed && <div className="mx-1 mt-5 border border-cyan-100/20 px-3 py-3"><p className="text-[9px] tracking-[0.18em] text-cyan-100/70">EXTERNAL SITE MODE</p><p className="mt-1 text-xs leading-5 text-white/80">Capture only. Your account remains under your control.</p></div>}
          </SidebarHeader>
          <SidebarContent className="px-2">
            <SidebarMenu className="gap-1">
              {menuItems.map(item => {
                const active = location === item.path || (item.path === "/" && location === "");
                return <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton isActive={active} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-10 rounded-none text-white/75 hover:bg-white/10 hover:text-white data-[active=true]:bg-cyan-200 data-[active=true]:text-[#061B5A]">
                    <item.icon className="h-4 w-4" /><span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>;
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-3">
            <div className="border-t border-white/15 pt-3"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 text-left"><Avatar className="h-8 w-8 rounded-none border border-white/30"><AvatarFallback className="rounded-none bg-white/10 text-xs text-white">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium">{user?.name ?? "Owner"}</p><p className="truncate text-[10px] text-cyan-100/70">Personal workspace</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-cyan-200/50 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
      </div>
      <SidebarInset className="blueprint-grid min-h-screen bg-[#061B5A] text-white"><main className="flex-1 p-4 md:p-7">{children}</main></SidebarInset>
    </>
  );
}
