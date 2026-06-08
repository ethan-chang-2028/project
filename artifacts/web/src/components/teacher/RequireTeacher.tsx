import type { ReactNode } from "react";
import { Redirect } from "wouter";
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
} from "@workspace/api-client-react";

/**
 * Gate teacher-only pages: shows a loader while resolving the session, sends
 * logged-out users to /login and non-teachers back to their dashboard.
 */
export function RequireTeacher({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Redirect to="/login" />;
  if (user.role !== "teacher") return <Redirect to="/dashboard" />;
  return <>{children}</>;
}
