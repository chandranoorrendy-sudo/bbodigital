import { createBrowserClient } from "@supabase/ssr";
import { SESSION_MAX_AGE } from "./config";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: { maxAge: SESSION_MAX_AGE } },
  );
}
