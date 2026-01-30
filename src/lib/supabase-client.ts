// src/lib/supabase-client.ts
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Rehydrate Supabase session from localStorage if present.
 * This helps preserve the auth session across page reloads.
 */
export const rehydrateSession = async () => {
    try {
        const stored = localStorage.getItem("supabase.auth.token");
        if (stored) {
            const token = JSON.parse(stored);
            if (token?.access_token) {
                await supabase.auth.setSession({
                    access_token: token.access_token,
                    refresh_token: token.refresh_token,
                });
            }
        }
    } catch (e) {
        console.warn("Supabase session rehydration failed", e);
    }
};
