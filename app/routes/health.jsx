/**
 * Health check - no auth, no DB. Use GET /health to verify the server is up.
 * (If you get 404 on /health after deploy, ensure this file was pushed and Railway rebuilt.)
 */
export const loader = async () => {
  throw new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
};

export default function Health() {
  return null;
}
