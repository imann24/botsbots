import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
const title = "Botsbots — Different minds. Shared momentum.";
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
    siteName: "Botsbots",
    title,
    description,
  },
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
        <Analytics />
      </body>
    </html>
  );
}
