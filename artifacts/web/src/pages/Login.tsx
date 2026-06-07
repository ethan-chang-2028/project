import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCurrentUserQueryKey,
  useLogin,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GoogleButton, OrDivider } from "@/components/google-button";
import { getErrorMessage } from "@/lib/errors";
import { oauthErrorMessage } from "@/lib/oauth-error";

export default function Login() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const login = useLogin();

  const search = useSearch();
  const oauthError = oauthErrorMessage(new URLSearchParams(search).get("error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const user = await login.mutateAsync({ data: { email, password } });
      // Seed the cache so the dashboard renders immediately on redirect.
      queryClient.setQueryData(getGetCurrentUserQueryKey(), user);
      navigate("/dashboard");
    } catch {
      // Surfaced via `login.error` below.
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Log in to your StepCheck account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {oauthError && (
            <p className="text-sm text-destructive" data-testid="text-oauth-error">
              {oauthError}
            </p>
          )}

          <GoogleButton label="Continue with Google" />
          <OrDivider />

          <form onSubmit={onSubmit} className="space-y-4" data-testid="form-login">
            {login.isError && (
              <p className="text-sm text-destructive" data-testid="text-login-error">
                {getErrorMessage(login.error)}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="input-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={login.isPending}
              data-testid="button-login"
            >
              {login.isPending ? "Logging in…" : "Log in"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Need an account?{" "}
            <Link href="/signup" className="font-medium text-foreground underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
