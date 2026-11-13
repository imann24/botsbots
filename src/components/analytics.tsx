"use client";

import { Analytics } from "@vercel/analytics/next";
import { redactAnalyticsUrl } from "@/lib/analytics";

export function PlatformAnalytics() {
  return <Analytics beforeSend={redactAnalyticsUrl} />;
}
