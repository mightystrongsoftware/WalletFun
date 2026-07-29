import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000",
  webOrigin: process.env.WEB_ORIGIN ?? "http://127.0.0.1:3001",
  contentProvider: process.env.CONTENT_PROVIDER ?? "memory",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  applePassTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER,
  appleTeamIdentifier: process.env.APPLE_TEAM_IDENTIFIER
};

