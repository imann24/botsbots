import type { Metadata } from "next";
import { PlatformAnalytics } from "@/components/analytics";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
const title = "BotsBots — Different minds. Shared momentum.";
const description =
  "A room for you and a few good AI perspectives. Constructive conversations, clear limits, and models from across the spectrum.";
const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL ||
      (deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000"),
  ),
  title,
  description,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "BotsBots",
    title,
    description,
  },
  // iOS otherwise turns the account email into a mail link.
  formatDetection: { email: false, address: false, telephone: false },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PlatformAnalytics />
      </body>
    </html>
  );
}
