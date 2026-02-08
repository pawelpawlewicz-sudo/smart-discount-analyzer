/**
 * GET /diagnostic - no auth. Returns basic env/DB check for debugging "Application failed to respond".
 * Remove or restrict in production if you don't want this exposed.
 */
export const loader = async () => {
  const checks = {
    SHOPIFY_APP_URL_set: Boolean(process.env.SHOPIFY_APP_URL),
    SHOPIFY_APP_URL_value: process.env.SHOPIFY_APP_URL
      ? `${process.env.SHOPIFY_APP_URL.slice(0, 30)}...`
      : "(empty)",
    SHOPIFY_API_KEY_set: Boolean(process.env.SHOPIFY_API_KEY),
    DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
    NODE_ENV: process.env.NODE_ENV || "(not set)",
  };

  let dbOk = false;
  if (process.env.DATABASE_URL) {
    try {
      const prisma = (await import("../db.server")).default;
      await prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch (e) {
      checks.db_error = e?.message || String(e);
    }
  }
  checks.database_ok = dbOk;

  throw new Response(JSON.stringify(checks, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default function Diagnostic() {
  return null;
}
