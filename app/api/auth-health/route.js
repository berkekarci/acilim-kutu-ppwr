export const dynamic = "force-dynamic";

export async function GET() {
  const username = process.env.ADMIN_USERNAME || "";
  const password = process.env.ADMIN_PASSWORD || "";
  const sessionSecret = process.env.SESSION_SECRET || "";

  return Response.json(
    {
      ok: true,
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      adminUsernameSet: Boolean(username),
      adminUsernameLength: username.length,
      adminUsernameIsYonetici: username === "yonetici",
      adminPasswordSet: Boolean(password),
      adminPasswordLength: password.length,
      adminPasswordMeetsMinimum: password.length >= 12,
      sessionSecretSet: Boolean(sessionSecret),
      sessionSecretLength: sessionSecret.length,
      sessionSecretMeetsMinimum: sessionSecret.length >= 32,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
