import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Service — BotsBots" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms govern your use of BotsBots at botsbots.app, operated by
        Isaiah Mann. By using the service, you agree to these terms. If you do
        not agree, do not use BotsBots. Questions can be sent to{" "}
        <a href="mailto:hello@botsbots.app">hello@botsbots.app</a>.
      </p>
      <h2>Your account</h2>
      <p>
        You must be legally able to agree to these terms and provide accurate
        account information. Protect your sign-in credentials and use only
        accounts you are authorized to access. Contact us if you believe your
        account has been compromised.
      </p>
      <h2>Using BotsBots</h2>
      <p>
        BotsBots lets you create conversations with AI models. Use the service
        lawfully and respect other people’s rights. Do not use it to distribute
        unlawful content, infringe intellectual property or privacy, compromise
        systems, abuse other users, bypass access controls or usage limits, or
        disrupt the service.
      </p>
      <h2>Your content and AI responses</h2>
      <p>
        You retain any rights you have in the content you submit. You give
        BotsBots permission to store, process, and transmit that content to the
        service providers needed to operate the features you use, including the
        AI providers serving your selected models. You are responsible for
        having the necessary permissions to submit that content.
      </p>
      <p>
        AI responses can be inaccurate, incomplete, biased, or similar to
        responses given to others. Review and verify outputs before relying on
        or sharing them. They are not a substitute for qualified professional
        advice. BotsBots does not guarantee the accuracy, originality, or
        suitability of generated content.
      </p>
      <h2>Availability and usage limits</h2>
      <p>
        Model availability, features, and usage allowances may change. Usage and
        cost displays are estimates used to manage the service. BotsBots may
        pause requests when limits are reached or providers are unavailable. We
        do not guarantee uninterrupted availability; export information you need
        to keep independently.
      </p>
      <h2>Privacy</h2>
      <p>
        Our <Link href="/privacy">privacy policy</Link> describes account
        information, conversation processing, service providers, and your
        privacy choices.
      </p>
      <h2>Suspension and ending use</h2>
      <p>
        You may stop using BotsBots at any time and contact us to request
        account deletion. We may restrict or suspend access when needed to
        address misuse, security risks, legal requirements, or violations of
        these terms. Archiving a conversation does not delete it.
      </p>
      <h2>Disclaimers</h2>
      <p>
        To the extent permitted by applicable law, BotsBots is provided “as is”
        and “as available,” without warranties of merchantability, fitness for a
        particular purpose, or non-infringement. Nothing in these terms excludes
        rights or liabilities that cannot lawfully be excluded.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms as the service evolves. Updated terms will be
        posted here with a revised date, and we will provide additional notice
        where required. If you disagree with an update, stop using the service.
      </p>
    </LegalPage>
  );
}
