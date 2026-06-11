export type DataMode = "demo" | "supabase";

export type Workstream = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type TaskStatus = "backlog" | "todo" | "doing" | "blocked" | "done";
export type TaskPriority = "P0" | "P1" | "P2";

export type Task = {
  id: string;
  title: string;
  description: string;
  workstream_id: string;
  status: TaskStatus;
  priority: TaskPriority;
  sprint_day: number | null;
  due_date: string | null;
  owner: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  sort_order: number;
};

export type MilestonePhase = "pilot" | "bulgaria" | "eu" | "us" | "insurance";
export type MilestoneStatus = "pending" | "hit" | "missed" | "at_risk";

export type Milestone = {
  id: string;
  title: string;
  target_date: string;
  phase: MilestonePhase;
  status: MilestoneStatus;
  description: string;
};

export type KpiCategory = "product" | "commercial" | "financial" | "clinical_safety";

export type Kpi = {
  id: string;
  key: string;
  label: string;
  unit: string;
  category: KpiCategory;
  target_y1: number;
  sort_order: number;
};

export type KpiEntry = {
  id: string;
  kpi_id: string;
  date: string;
  value: number;
  note: string;
};

export type ClinicStage = "lead" | "contacted" | "demo" | "pilot" | "paying" | "churned";

export type Clinic = {
  id: string;
  name: string;
  city: string;
  country: string;
  contact_name: string;
  contact_email: string;
  phone: string;
  stage: ClinicStage;
  mrr: number;
  vets_count: number;
  notes: string;
  last_touch: string | null;
  next_action: string;
  next_action_date: string | null;
};

export type InvestorStage =
  | "research"
  | "contacted"
  | "meeting"
  | "dd"
  | "term_sheet"
  | "committed"
  | "passed";

export type InvestorType = "angel" | "preseed" | "seed" | "series_a";

export type Investor = {
  id: string;
  name: string;
  firm: string;
  type: InvestorType;
  country: string;
  stage: InvestorStage;
  check_min: number;
  check_max: number;
  warm_intro_via: string;
  last_touch: string | null;
  next_action: string;
  notes: string;
};

export type RiskCategory =
  | "market"
  | "execution"
  | "regulatory"
  | "safety"
  | "funding"
  | "competition"
  | "technical";

export type RiskStatus = "open" | "mitigating" | "closed";

export type Risk = {
  id: string;
  title: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  mitigation: string;
  owner: string;
  status: RiskStatus;
  review_date: string;
};

export type DocumentType = "strategy" | "legal" | "pitch" | "financial" | "clinical" | "other";

export type Document = {
  id: string;
  title: string;
  type: DocumentType;
  url: string;
  content_md: string;
  updated_at: string;
};

export type Decision = {
  id: string;
  date: string;
  title: string;
  context: string;
  decision: string;
  alternatives: string;
  owner: string;
};

export type WeeklyUpdate = {
  id: string;
  week_start: string;
  wins: string;
  problems: string;
  metrics_note: string;
  next_week: string;
};

export type Database = {
  workstreams: Workstream[];
  tasks: Task[];
  milestones: Milestone[];
  kpis: Kpi[];
  kpi_entries: KpiEntry[];
  clinics: Clinic[];
  investors: Investor[];
  risks: Risk[];
  documents: Document[];
  decisions: Decision[];
  weekly_updates: WeeklyUpdate[];
};

export type TableName = keyof Database;
export type Entity = Database[TableName][number];

export type TableRow<T extends TableName> = Database[T][number];
