import { AppShell } from "@/components/layout/AppShell";

export default function OptionsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell title="Options">{children}</AppShell>;
}
