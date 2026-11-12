import { createHash } from "node:crypto";
import { ApiError, authenticated, failure, jsonBody } from "@/lib/api";
import { contactKinds, contactSchema } from "@/lib/contact";

export async function POST(request: Request) {
  try {
    const { user } = await authenticated(request);
    const input = contactSchema.parse(await jsonBody(request));
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey)
      throw new ApiError(
        "Contact is temporarily unavailable. Please try again later.",
        503,
      );

    // Identical retries share a key for Resend's 24-hour deduplication window.
    const key = createHash("sha256")
      .update(JSON.stringify([user.id, input]))
      .digest("hex");
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `contact/${key}`,
        },
        body: JSON.stringify({
          from:
            process.env.CONTACT_FROM_EMAIL?.trim() || "noreply@botsbots.app",
          to: [
            process.env.CONTACT_ADMIN_EMAIL?.trim() || "isaiahbmann@gmail.com",
          ],
          reply_to: input.email,
          subject: `[BotsBots] ${contactKinds[input.kind]}`,
          text: [
            `Request: ${contactKinds[input.kind]}`,
            `Reply to: ${input.email}`,
            `Account email: ${user.email ?? "Unavailable"}`,
            `Account ID: ${user.id}`,
            "",
            input.message,
          ].join("\n"),
        }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError(
        "We couldn’t confirm your message was sent. Please try again; identical retries won’t send duplicate emails.",
        502,
      );
    }
    if (!response.ok) {
      // Keep provider details and credentials out of the client response and logs.
      console.error("Contact email failed with status", response.status);
      throw new ApiError(
        "Your message couldn’t be sent. Please try again in a moment.",
        502,
      );
    }
    return Response.json(
      { sent: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
