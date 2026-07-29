import { config } from "../config.js";
import { ContentProvider } from "./ContentProvider.js";
import { InMemoryContentProvider } from "./InMemoryContentProvider.js";
import { SupabaseContentProvider } from "./SupabaseContentProvider.js";

export function createContentProvider(): ContentProvider {
  if (config.contentProvider === "supabase") {
    if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when CONTENT_PROVIDER=supabase");
    }

    return new SupabaseContentProvider(config.supabaseUrl, config.supabaseServiceRoleKey);
  }

  return new InMemoryContentProvider();
}

