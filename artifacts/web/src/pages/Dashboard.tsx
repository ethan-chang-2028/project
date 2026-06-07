import { Redirect, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useLogout,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Dashboard() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const logout = useLogout();

  // `retry: false` means a 401 resolves quickly to an error (our "logged out"
  // signal) instead of being retried.
  const { data: user, isLoading } = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false },
  });

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } finally {
      queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
      navigate("/login");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md" data-testid="card-dashboard">
        <CardHeader>
          <CardDescription>Signed in as</CardDescription>
          <CardTitle className="text-2xl" data-testid="text-user-name">
            {user.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between border-b border-border pb-3">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium text-foreground" data-testid="text-user-email">
                {user.email}
              </dd>
            </div>
            <div className="flex justify-between border-b border-border pb-3">
              <dt className="text-muted-foreground">Role</dt>
              <dd
                className="font-medium capitalize text-foreground"
                data-testid="text-user-role"
              >
                {user.role}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="font-medium text-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>

          <div className="mt-8">
            <Button
              variant="outline"
              className="w-full"
              onClick={onLogout}
              disabled={logout.isPending}
              data-testid="button-logout"
            >
              {logout.isPending ? "Logging out…" : "Log out"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
