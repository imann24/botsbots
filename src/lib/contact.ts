import { z } from "zod";

export const contactKinds = {
  support: "Support",
  question: "Question",
  feedback: "Feedback",
  limits: "Higher usage limits",
} as const;
export type ContactKind = keyof typeof contactKinds;

export const contactSchema = z.object({
  kind: z.enum(["support", "question", "feedback", "limits"]),
  email: z.email().max(254),
  message: z
    .string()
    .trim()
    .min(10, "Please include at least 10 characters.")
    .max(5000),
});
