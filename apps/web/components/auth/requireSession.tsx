"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/hooks/useAuth";

interface RequireSessionProps {
  children: React.ReactNode;
}

/**
 * The other half of the sign-in redirect. Without it /tenders renders for a
 * signed-out visitor and every panel below it fails its own 401 separately —
 * a dashboard-shaped error page instead of the login form.
 *
 * The session cookie is httpOnly and set by the api on another origin, so Next
 * middleware on :3100 cannot read it. The check has to happen client side,
 * against /auth/me, which is why this is a component and not middleware.
 */
export default function RequireSession({ children }: RequireSessionProps) {
  const me = useMe();
  const router = useRouter();
  const signedOut = me.data === null;

  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

  if (me.isLoading || signedOut) {
    return <div className="m-5 h-64 max-w-5xl animate-pulse rounded-2xl bg-soft md:m-8" data-testid="session-loading" aria-label="Chargement de votre espace" />;
  }

  // A network failure is not a signed-out session: say so rather than bouncing
  // the user to a login form they do not need.
  if (me.isError) {
    return (
      <div className="m-8 rounded-md border border-border bg-warning-soft px-4 py-3 text-sm text-warning" role="alert" data-testid="session-error">
        Session indisponible. Réessayez dans un instant.
        <button className="ml-3 cursor-pointer underline underline-offset-4" onClick={() => void me.refetch()}>Réessayer</button>
      </div>
    );
  }

  return <>{children}</>;
}
