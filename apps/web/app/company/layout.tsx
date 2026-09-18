import { WorkspaceShell } from "@/components/workspace/workspaceShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
