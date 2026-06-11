import { z } from "zod";

const required = z.string().min(1, "Required");
const nullableDate = z.string().optional().nullable();

export const taskSchema = z.object({
  title: required,
  description: z.string().optional().default(""),
  workstream_id: required,
  status: z.enum(["backlog", "todo", "doing", "blocked", "done"]),
  priority: z.enum(["P0", "P1", "P2"]),
  sprint_day: z.coerce.number().int().min(1).max(7).nullable().optional(),
  due_date: nullableDate,
  owner: z.string().optional().default("Founder"),
  tags: z.array(z.string()).default([]),
});

export const milestoneSchema = z.object({
  title: required,
  target_date: required,
  phase: z.enum(["pilot", "bulgaria", "eu", "us", "insurance"]),
  status: z.enum(["pending", "hit", "missed", "at_risk"]),
  description: z.string().optional().default(""),
});

export const kpiEntrySchema = z.object({
  kpi_id: required,
  date: required,
  value: z.coerce.number(),
  note: z.string().optional().default(""),
});

export const clinicSchema = z.object({
  name: required,
  city: required,
  country: required,
  contact_name: z.string().optional().default(""),
  contact_email: z.string().email().or(z.literal("")).default(""),
  phone: z.string().optional().default(""),
  stage: z.enum(["lead", "contacted", "demo", "pilot", "paying", "churned"]),
  mrr: z.coerce.number().min(0).default(0),
  vets_count: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().default(""),
  last_touch: nullableDate,
  next_action: z.string().optional().default(""),
  next_action_date: nullableDate,
});

export const investorSchema = z.object({
  name: required,
  firm: z.string().optional().default(""),
  type: z.enum(["angel", "preseed", "seed", "series_a"]),
  country: required,
  stage: z.enum(["research", "contacted", "meeting", "dd", "term_sheet", "committed", "passed"]),
  check_min: z.coerce.number().min(0).default(0),
  check_max: z.coerce.number().min(0).default(0),
  warm_intro_via: z.string().optional().default(""),
  last_touch: nullableDate,
  next_action: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const riskSchema = z.object({
  title: required,
  category: z.enum(["market", "execution", "regulatory", "safety", "funding", "competition", "technical"]),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  mitigation: z.string().optional().default(""),
  owner: z.string().optional().default("Founder"),
  status: z.enum(["open", "mitigating", "closed"]),
  review_date: required,
});

export const documentSchema = z.object({
  title: required,
  type: z.enum(["strategy", "legal", "pitch", "financial", "clinical", "other"]),
  url: z.string().url().or(z.literal("")).default(""),
  content_md: z.string().optional().default(""),
});

export const decisionSchema = z.object({
  date: required,
  title: required,
  context: z.string().optional().default(""),
  decision: z.string().optional().default(""),
  alternatives: z.string().optional().default(""),
  owner: z.string().optional().default("Founder"),
});

export const weeklyUpdateSchema = z.object({
  week_start: required,
  wins: z.string().optional().default(""),
  problems: z.string().optional().default(""),
  metrics_note: z.string().optional().default(""),
  next_week: z.string().optional().default(""),
});
