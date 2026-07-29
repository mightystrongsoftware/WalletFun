import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3000),
  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000",
  webOrigins: (process.env.WEB_ORIGIN ?? "http://127.0.0.1:3001")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  contentProvider: process.env.CONTENT_PROVIDER ?? "memory",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  applePassTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER,
  appleTeamIdentifier: process.env.APPLE_TEAM_IDENTIFIER,
  appleWwdrCertPath: process.env.APPLE_WWDR_CERT_PATH,
  appleWwdrCertPem: process.env.APPLE_WWDR_CERT_PEM,
  applePassCertPath: process.env.APPLE_PASS_CERT_PATH,
  applePassCertPem: process.env.APPLE_PASS_CERT_PEM,
  applePassKeyPath: process.env.APPLE_PASS_KEY_PATH,
  applePassKeyPem: process.env.APPLE_PASS_KEY_PEM,
  applePassCertPassword: process.env.APPLE_PASS_CERT_PASSWORD
};
