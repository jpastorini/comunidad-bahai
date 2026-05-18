"use client";

import { useState } from "react";
import { SidebarContent } from "./Sidebar";
import { Toaster } from "@/components/Toaster";
import type { Profile } from "@/lib/types";

type Props = {
  profile: Profile;
  children: React.ReactNode;
  toast?: { tone: "success" | "error" | "info"; message: string } | null;
};

/**
 * Responsive shell:
 *  - Desktop (md+): fixed sidebar 256px on the left, main content fills the rest.
 *  - Mobile: top bar with hamburger that opens a slide-in drawer.
 */
export function AdminShell({ profile, children, toast }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-bg">
      <Toaster toast={toast ?? null} />
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-black/[0.06] bg-card px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Abrir menú"
          onClick={() => setDrawerOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-dark hover:bg-bg"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="font-display text-[18px] font-semibold text-dark">
          Admin
        </div>
        <div className="w-9" />
      </header>

      {/* Drawer overlay (mobile) */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-black/[0.06] bg-card transition-transform duration-200 md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          profile={profile}
          onNavigate={() => setDrawerOpen(false)}
        />
      </aside>

      {/* Main */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-10 md:py-10 xl:px-14">
          {children}
        </div>
      </main>
    </div>
  );
}
