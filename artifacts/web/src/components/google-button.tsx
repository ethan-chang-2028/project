import { FcGoogle } from "react-icons/fc";

import { Button } from "@/components/ui/button";

/**
 * "Continue with Google" button. It's a plain link (full-page navigation, not
 * a fetch) to the server's OAuth start endpoint, which redirects to Google.
 *
 * Rendered by default; set `VITE_GOOGLE_ENABLED=false` at build time to hide it
 * (e.g. in environments where Google credentials aren't configured).
 */
export function GoogleButton({ label }: { label: string }) {
  if (import.meta.env.VITE_GOOGLE_ENABLED === "false") return null;

  return (
    <Button asChild variant="outline" className="w-full" data-testid="button-google">
      <a href="/api/auth/google">
        <FcGoogle className="size-4" />
        {label}
      </a>
    </Button>
  );
}

/** A labelled "or" divider used between the OAuth button and the form. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
