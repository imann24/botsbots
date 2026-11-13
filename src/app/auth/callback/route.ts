import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const providerError = url.searchParams.get("error");

  if (code && !providerError) {
    try {
      const client = await userClient();
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error) {
        return redirectHome();
      }
    } catch {
      // Do not expose provider responses, authorization codes, or tokens.
    }
  }

  return redirectHome(
    providerError === "access_denied" ? "cancelled" : "failed",
  );
}

function redirectHome(error?: "cancelled" | "failed") {
  // A relative Location preserves the browser's host behind reverse proxies
  // (including 127.0.0.1 vs localhost) without trusting forwarded-host headers.
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: error ? `/?auth_error=${error}` : "/",
      "Cache-Control": "private, no-store",
    },
  });
}
