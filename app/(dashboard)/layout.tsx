import DashboardShell from '@/components/DashboardShell';

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
