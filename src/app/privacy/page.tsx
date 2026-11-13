import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy — BotsBots" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        BotsBots is an AI conversation workspace operated by Isaiah Mann. This
        policy explains how information is handled when you use botsbots.app.
        For privacy questions or requests, email{" "}
        <a href="mailto:isaiahbmann@gmail.com">isaiahbmann@gmail.com</a>.
      </p>
      <h2>Information we collect</h2>
      <p>
        We store account information, your conversations and AI replies, room
        titles, topics, bot instructions, summaries, preferences, and usage
        records such as token counts and estimated costs. If you contact us, we
        receive your message, reply address, and account details.
      </p>
      <p>
        When you sign in with Google, Google provides your account identifier,
        email address, and basic profile information, which may include your
        name and profile picture. Supabase processes this information to create
        or recognize your account and manage your session. BotsBots does not
        request access to your Gmail messages, Google Drive files, contacts, or
        calendar.
      </p>
      <h2>How we use information</h2>
      <p>
        We use this information to authenticate you, save and retrieve your
        workspace, generate AI responses and summaries, apply usage limits,
        maintain security, troubleshoot problems, and respond to support
        requests. Google account information is used for account and
        authentication purposes; it is not added to AI prompts by the
        application.
      </p>
      <h2>Service providers and AI processing</h2>
      <p>
        Supabase provides authentication and database storage. Vercel provides
        hosting, analytics, and the AI Gateway. When you run a conversation or
        request a summary, relevant conversation content, instructions, and
        context are sent through the AI Gateway to the providers serving your
        selected models. Those providers process this content under their
        applicable terms and privacy policies. Avoid submitting information you
        do not have permission to share.
      </p>
      <p>
        Support messages are delivered through Resend to the operator. Hosting
        and infrastructure providers may process technical information such as
        IP addresses, request metadata, and operational logs to deliver and
        protect the service. Information may be processed in countries other
        than your own.
      </p>
      <h2>Cookies and analytics</h2>
      <p>
        Authentication cookies keep you signed in. Browser storage also
        remembers preferences such as appearance. We use Vercel Analytics for
        page visits and aggregate interaction events. Our custom analytics
        exclude conversation text, account identifiers, credentials, and URL
        query strings or fragments.
      </p>
      <h2>Storage and your choices</h2>
      <p>
        Conversation history and account records are retained to provide your
        saved workspace. Archiving a conversation hides it from the active list;
        it does not delete it. You can export conversations in the app and
        contact us to request access, correction, or deletion of your account
        information. We may need to verify your identity before acting on a
        request. Some information may remain in backups or be retained where
        needed for security, legal obligations, or resolving disputes.
      </p>
      <p>
        You can sign out at any time or remove BotsBots access through your
        Google Account settings. Removing Google access does not itself delete
        information already stored in BotsBots. Depending on your location, you
        may have additional privacy rights; contact us to exercise them.
      </p>
      <h2>Changes to this policy</h2>
      <p>
        We will update this page when our practices change and revise the date
        above. We will provide additional notice where required.
      </p>
    </LegalPage>
  );
}
