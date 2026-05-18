import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="app-shell">
      {children}
      <TabBar />
    </div>
  );
}
