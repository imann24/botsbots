import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <header>
        <Link href="/" aria-label="BotsBots home">
          <Brand />
        </Link>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </header>
      <article>
        <h1>{title}</h1>
        <p className="legal-date">Last updated November 13, 2026</p>
        {children}
      </article>
      <footer>
        <Link href="/">Back to BotsBots</Link>
      </footer>
    </main>
  );
}
