import { WorkspaceShell } from "@/components/workspace/workspaceShell";
interface LayoutProps { children: React.ReactNode }
export default function Layout({ children }: LayoutProps) { return <WorkspaceShell>{children}</WorkspaceShell>; }
