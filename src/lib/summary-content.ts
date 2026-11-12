import { z } from "zod";
export const summaryContentSchema = z.object({
  version: z.literal(1),
  contributions: z.array(
    z.object({
      botId: z.string(),
      speaker: z.string(),
      model: z.string(),
      text: z.string(),
    }),
  ),
  synthesis: z.string(),
});
export type SummaryContent = z.infer<typeof summaryContentSchema>;
export function parseSummaryContent(content: string): SummaryContent | null {
  try {
    const parsed = summaryContentSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
