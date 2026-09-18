import RequireSession from "@/components/auth/requireSession";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RequireSession>{children}</RequireSession>;
}
