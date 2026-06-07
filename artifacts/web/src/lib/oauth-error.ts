/** Map an OAuth `?error=` code (set by the server on redirect) to a message. */
export function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "google_not_configured":
      return "Google sign-in isn't configured on the server yet.";
    case "google_state_mismatch":
      return "Google sign-in expired or was interrupted. Please try again.";
    case "access_denied":
      return "Google sign-in was cancelled.";
    case "google_failed":
      return "Google sign-in failed. Please try again.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}
