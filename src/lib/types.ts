import { z } from "zod";
import { MODEL_CHOICES } from "./models";
import { AGENT_COLOR_COUNT } from "./agent-colors";
export const settingsSchema = z.object({
  mode: z.enum(["moderated", "free"]),
  maxMessages: z.number().int().min(4).max(100),
  maxPerBot: z.number().int().min(1).max(30),
  budget: z.number().min(0.01).max(5),
  maxTokens: z.number().int().min(128).max(2000),
  contextMessages: z.number().int().min(2).max(30),
  concurrency: z.number().int().min(1).max(4),
  cooldownSeconds: z.number().int().min(1).max(30),
  maxMinutes: z.number().int().min(1).max(30),
});
export const botSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(32),
  model: z.enum(MODEL_CHOICES.map((m) => m.id)),
  perspective: z.string().trim().min(1).max(1000),
  // Chat color slot, unique per bot in a room. Optional for rooms created
  // before colors were stored; the server fills it in on create/save.
  color: z
    .number()
    .int()
    .min(0)
    .max(AGENT_COLOR_COUNT - 1)
    .optional(),
});
export const roomTitleSchema = z.string().trim().min(1).max(80);
export const roomSchema = z.object({
  title: roomTitleSchema,
  topic: z.string().trim().min(3).max(2000),
  purpose: z.enum(["plan", "research", "debate", "explore"]),
  bots: z
    .array(botSchema)
    .min(2)
    .max(6)
    .refine(
      (b) => new Set(b.map((x) => x.id)).size === b.length,
      "Bot IDs must be unique",
    ),
  settings: settingsSchema,
});
// Only creation accepts an unnamed room. Settings and renames require a title.
export const createRoomSchema = roomSchema.extend({
  title: z.string().trim().max(80).default(""),
});
export type Settings = z.infer<typeof settingsSchema>;
export type Bot = z.infer<typeof botSchema>;
export type RoomDraft = z.infer<typeof roomSchema>;
export type Room = RoomDraft & {
  id: string;
  user_id: string;
  status: "paused" | "running" | "stopped" | "limited" | "error";
  reason: string | null;
  run_id: string | null;
  run_started_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};
export type Message = {
  id: string;
  room_id: string;
  sequence: number;
  bot_id: string | null;
  speaker: string;
  model: string | null;
  content: string;
  status: "pending" | "complete" | "failed";
  run_id: string | null;
  reserved_cost: number;
  cost: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  finish_reason: string | null;
  reasoning_tokens: number | null;
};
export const DEFAULT_SETTINGS: Settings = {
  mode: "moderated",
  maxMessages: 16,
  maxPerBot: 4,
  budget: 0.25,
  maxTokens: 800,
  contextMessages: 12,
  concurrency: 2,
  cooldownSeconds: 2,
  maxMinutes: 5,
};
export const DEFAULT_BOTS: Bot[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    color: 0,
    name: "The strategist",
    model: "openai/gpt-6-luna",
    perspective:
      "Turn ideas into a practical plan. Prioritize the highest-impact next step and make trade-offs explicit.",
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    color: 1,
    name: "The challenger",
    model: "anthropic/claude-haiku-5.5",
    perspective:
      "Stress-test assumptions constructively. Find blind spots, ask sharp questions, and propose improvements.",
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    color: 2,
    name: "The explorer",
    model: "google/gemini-3.5-flash-lite",
    perspective:
      "Connect unexpected ideas. Offer a fresh perspective and a concrete alternative worth exploring.",
  },
];
