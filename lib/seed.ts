import {
  Clinic,
  Decision,
  Document,
  Investor,
  Kpi,
  KpiEntry,
  Milestone,
  Risk,
  Task,
  WeeklyUpdate,
  Workstream,
  Database,
} from "@/types";

const now = "2026-06-11T05:34:00.000Z";
const sprintBase = "2026-06-11";

export const workstreams: Workstream[] = [
  { id: "ws-product", name: "Product", color: "#0E9594", icon: "rocket" },
  { id: "ws-clinical", name: "Clinical", color: "#22C55E", icon: "stethoscope" },
  { id: "ws-gtm", name: "GTM", color: "#E3B23C", icon: "megaphone" },
  { id: "ws-fundraising", name: "Fundraising", color: "#A855F7", icon: "landmark" },
  { id: "ws-regulatory", name: "Regulatory", color: "#EF4444", icon: "shield" },
  { id: "ws-data-ai", name: "Data/AI", color: "#3B82F6", icon: "brain" },
];

const taskSpecs: Array<[number, string, string, string, Task["priority"], Task["status"]]> = [
  [1, "Register company checklist", "Confirm incorporation, accountant, bank, and founder admin steps.", "ws-regulatory", "P0", "doing"],
  [1, "Landing page live on theveterinarian.ai", "Waitlist and clinic interest forms with basic founder analytics.", "ws-gtm", "P0", "doing"],
  [1, "Brand kit", "Logo, palette, and usage rules for clinic-facing collateral.", "ws-product", "P1", "todo"],
  [1, "Legal disclaimers EN/BG", "Triage-not-diagnosis language plus emergency redirect copy.", "ws-regulatory", "P0", "todo"],
  [1, "Analytics (PostHog) wired", "Track waitlist, clinic interest, AI consult start, and escalation events.", "ws-data-ai", "P1", "todo"],
  [2, "Pet profile + auth", "Email/phone OTP, pet basics, consent flags, and medical record starter.", "ws-product", "P0", "todo"],
  [2, "AI vet chat v1", "Claude API integration with system prompt and triage protocol.", "ws-data-ai", "P0", "todo"],
  [2, "Red-flag emergency ruleset v1", "24 presentations that trigger go-to-clinic-now guidance and nearest ER info.", "ws-clinical", "P0", "todo"],
  [3, "Multimodal input", "Photo upload path into chat and structured image notes for handoff.", "ws-product", "P0", "todo"],
  [3, "Bulgarian language QA pass with vets", "Review core flows, emergency copy, and clinic handoff text.", "ws-clinical", "P0", "todo"],
  [3, "Conversation history + handoff summary generator", "Summaries for escalated cases and clinic inbox review.", "ws-data-ai", "P1", "todo"],
  [4, "Clinic console v1", "Escalated chats queue and booking requests inbox.", "ws-product", "P0", "todo"],
  [4, "White-label config", "Clinic name, logo, hours, emergency contacts, and tone settings.", "ws-product", "P1", "todo"],
  [4, "Booking request to email/SMS flow", "Clinic receives structured request with owner and pet context.", "ws-gtm", "P0", "todo"],
  [5, "Pilot onboarding with Central Veterinary Clinic Sofia", "Train 3 vets and define daily feedback rhythm.", "ws-clinical", "P0", "todo"],
  [5, "Vet feedback rubric", "Approve/correct each AI answer with issue taxonomy.", "ws-clinical", "P0", "todo"],
  [5, "Safety eval set v1", "Run and score 100 scripted cases.", "ws-data-ai", "P0", "todo"],
  [6, "Fix list from vet review", "Patch launch blockers from the first scored review session.", "ws-product", "P0", "todo"],
  [6, "Rate limiting + abuse guards", "Protect chat and upload endpoints from runaway cost and spam.", "ws-data-ai", "P1", "todo"],
  [6, "Uptime monitor + error alerting", "External monitor, Slack/email alerts, and error budget dashboard.", "ws-data-ai", "P1", "todo"],
  [6, "App Store-less PWA polish", "Installable, fast, branded mobile web experience.", "ws-product", "P2", "todo"],
  [7, "Soft launch to 200 clinic clients", "CVC sends SMS/email invitation and founder monitors first consults.", "ws-gtm", "P0", "todo"],
  [7, "Founder demo video recorded", "Two-minute product and clinic-console walkthrough.", "ws-gtm", "P1", "todo"],
  [7, "Day-7 retro + metrics snapshot", "Document learnings, KPI baseline, safety issues, and next sprint.", "ws-product", "P1", "todo"],
  [7, "Pre-seed one-pager sent to 10 angels", "Target warm angels and CEE funds with pilot proof points.", "ws-fundraising", "P0", "todo"],
];

export const tasks: Task[] = taskSpecs.map(([day, title, description, workstream_id, priority, status], index) => ({
  id: `task-${index + 1}`,
  title,
  description,
  workstream_id,
  status,
  priority,
  sprint_day: day,
  due_date: `2026-06-${String(10 + day).padStart(2, "0")}`,
  owner: index % 4 === 0 ? "Founder" : index % 4 === 1 ? "Product lead" : index % 4 === 2 ? "Vet advisor" : "AI engineer",
  tags: day <= 2 ? ["launch-critical"] : priority === "P0" ? ["pilot"] : ["ops"],
  created_at: now,
  updated_at: now,
  sort_order: index,
}));

export const milestones: Milestone[] = [
  { id: "ms-pilot-live", title: "Pilot live", target_date: "2026-06-30", phase: "pilot", status: "at_risk", description: "CVC Sofia pilot launched with safety review loop." },
  { id: "ms-10-clinics", title: "10 paying clinics", target_date: "2026-09-30", phase: "pilot", status: "pending", description: "First repeatable clinic sales motion." },
  { id: "ms-1000-mau", title: "1,000 consumer MAU", target_date: "2026-10-15", phase: "pilot", status: "pending", description: "Consumer demand signal from clinic clients and organic waitlist." },
  { id: "ms-preseed", title: "Pre-seed EUR500k closed", target_date: "2026-10-31", phase: "pilot", status: "pending", description: "Close enough capital for Bulgaria scale-up." },
  { id: "ms-bg-scale", title: "60 clinics + 25k MAU + EUR500k ARR run-rate", target_date: "2027-06-30", phase: "bulgaria", status: "pending", description: "National category leadership proof." },
  { id: "ms-seed", title: "Seed EUR3M", target_date: "2027-09-30", phase: "bulgaria", status: "pending", description: "Finance regional expansion and safety team." },
  { id: "ms-eu-launch", title: "Romania+Greece launch", target_date: "2027-12-15", phase: "eu", status: "pending", description: "Expand white-label AI Staff into neighboring markets." },
  { id: "ms-uk-a", title: "UK entry + Series A $15-20M", target_date: "2028-09-30", phase: "eu", status: "pending", description: "Enter high-ARPU English-speaking market." },
  { id: "ms-us", title: "US entry", target_date: "2029-03-31", phase: "us", status: "pending", description: "US launch with clinic groups and insurance partners." },
  { id: "ms-mga", title: "Insurance MGA pilot", target_date: "2029-06-30", phase: "insurance", status: "pending", description: "Risk data layer enables underwriting partner pilot." },
  { id: "ms-unicorn", title: "$25-40M ARR / unicorn round", target_date: "2029-12-31", phase: "insurance", status: "pending", description: "Raise growth round on network and insurance optionality." },
  { id: "ms-decacorn", title: "Decacorn checkpoint", target_date: "2031-12-31", phase: "insurance", status: "pending", description: "Evaluate global category leadership and public-company path." },
];

export const kpis: Kpi[] = [
  ["pets_um", "Pets under management", "count", "product", 30000],
  ["clinics_paying", "Paying clinics", "count", "commercial", 60],
  ["mrr", "MRR", "EUR", "financial", 41000],
  ["mau", "Consumer MAU", "count", "product", 25000],
  ["consults_wk", "AI consults / week", "count", "product", 4000],
  ["escalation_rate", "Escalation to vet rate", "%", "clinical_safety", 22],
  ["missed_emergency", "Missed emergency rate", "%", "clinical_safety", 0],
  ["vet_approval", "Vet approval of AI answers", "%", "clinical_safety", 95],
  ["nps", "Pet-owner NPS", "score", "product", 60],
  ["cac_clinic", "CAC per clinic", "EUR", "commercial", 400],
  ["churn_clinic", "Monthly clinic churn", "%", "commercial", 1.5],
  ["runway", "Runway", "months", "financial", 12],
].map(([key, label, unit, category, target], index) => ({
  id: `kpi-${key}`,
  key: key as string,
  label: label as string,
  unit: unit as string,
  category: category as Kpi["category"],
  target_y1: target as number,
  sort_order: index,
}));

const kpiTrajectories: Record<string, number[]> = {
  pets_um: [120, 210, 320, 470, 650, 880, 1150, 1450],
  clinics_paying: [0, 0, 0, 1, 1, 1, 2, 2],
  mrr: [0, 0, 0, 250, 400, 550, 900, 1200],
  mau: [40, 65, 90, 130, 190, 270, 380, 520],
  consults_wk: [8, 16, 28, 45, 72, 106, 155, 220],
  escalation_rate: [38, 35, 33, 31, 29, 27, 25, 24],
  missed_emergency: [0, 0, 0, 0, 0, 0, 0, 0],
  vet_approval: [74, 78, 81, 84, 86, 88, 90, 91],
  nps: [18, 24, 28, 34, 38, 42, 47, 51],
  cac_clinic: [900, 800, 720, 650, 590, 530, 485, 450],
  churn_clinic: [0, 0, 0, 0, 0, 0, 0, 0],
  runway: [6, 6, 5.8, 5.6, 5.4, 5.2, 5, 4.8],
};

const kpiDates = ["2026-04-17", "2026-04-24", "2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29", "2026-06-05"];

export const kpi_entries: KpiEntry[] = kpis.flatMap((kpi) =>
  kpiTrajectories[kpi.key].map((value, index) => ({
    id: `entry-${kpi.key}-${index + 1}`,
    kpi_id: kpi.id,
    date: kpiDates[index],
    value,
    note: index === 7 ? "Latest founder operating snapshot." : "Weekly demo seed.",
  })),
);

export const clinics: Clinic[] = [
  ["Central Veterinary Clinic", "Sofia", "pilot", 0, 12, "Anchor design partner; founder relationship."],
  ["Blue Cross Vet Center", "Sofia", "demo", 0, 7, "Interested in after-hours receptionist."],
  ["Animed 24", "Sofia", "contacted", 0, 5, "Needs emergency triage workflow."],
  ["Vet Family Clinic", "Sofia", "lead", 0, 4, "Small-animal practice near Lozenets."],
  ["Nova Vet Plovdiv", "Plovdiv", "demo", 0, 6, "Owner asked for Bulgarian language examples."],
  ["Trakia Animal Hospital", "Plovdiv", "contacted", 0, 9, "Large clinic, receptionist pain."],
  ["Green Paw Clinic", "Plovdiv", "lead", 0, 3, "Warm LinkedIn lead."],
  ["Varna Pet Care", "Varna", "demo", 0, 5, "Tourist-season volume spikes."],
  ["Black Sea Vet", "Varna", "contacted", 0, 4, "Needs appointment qualification."],
  ["Morska Gradina Vets", "Varna", "lead", 0, 3, "Follow after conference intro."],
  ["Burgas Animal Health", "Burgas", "contacted", 0, 5, "Open to AI scribe pilot."],
  ["South Coast Veterinary", "Burgas", "lead", 0, 2, "Owner likes client education angle."],
  ["Stara Zagora Vet Group", "Stara Zagora", "lead", 0, 8, "Agricultural university connection."],
  ["Ruse Companion Clinic", "Ruse", "contacted", 0, 4, "Ask for multi-location pricing."],
  ["Pleven Pet Hospital", "Pleven", "lead", 0, 6, "Cold outbound target."],
].map(([name, city, stage, mrr, vets, notes], index) => ({
  id: `clinic-${index + 1}`,
  name: name as string,
  city: city as string,
  country: "Bulgaria",
  contact_name: index === 0 ? "Dr. Elena Petrova" : `Dr. ${["Ivan", "Maria", "Georgi", "Nikolay", "Desislava"][index % 5]} ${["Petrov", "Dimitrova", "Ivanov", "Koleva", "Stoyanov"][index % 5]}`,
  contact_email: `contact${index + 1}@clinic.example`,
  phone: `+359 8${String(70000000 + index * 13719).slice(0, 8)}`,
  stage: stage as Clinic["stage"],
  mrr: mrr as number,
  vets_count: vets as number,
  notes: notes as string,
  last_touch: index < 9 ? `2026-06-${String(1 + index).padStart(2, "0")}` : null,
  next_action: index === 0 ? "Schedule daily pilot feedback standup" : "Send clinic AI Staff one-pager",
  next_action_date: `2026-06-${String(12 + (index % 8)).padStart(2, "0")}`,
}));

export const investors: Investor[] = [
  ["Eleven Ventures", "Eleven Ventures", "preseed", "Bulgaria", "contacted", 50000, 200000, "Founder network"],
  ["LAUNCHub Ventures", "LAUNCHub Ventures", "preseed", "Bulgaria", "research", 100000, 300000, "Portfolio founder intro"],
  ["Vitosha Venture Partners", "Vitosha Venture Partners", "preseed", "Bulgaria", "meeting", 50000, 250000, "CVC advisor"],
  ["BrightCap Ventures", "BrightCap", "seed", "Bulgaria", "research", 150000, 500000, "Need warm intro"],
  ["Payhawk Angel 1", "TBD via Payhawk network", "angel", "Bulgaria", "contacted", 10000, 50000, "Payhawk network"],
  ["Payhawk Angel 2", "TBD via Payhawk network", "angel", "Bulgaria", "research", 10000, 75000, "Payhawk network"],
  ["CEE Animal Health Angel", "Independent", "angel", "Romania", "contacted", 25000, 100000, "Vet-tech operator"],
  ["HealthTech Europe Scout", "EU Angels", "angel", "Germany", "research", 25000, 75000, "LinkedIn warm path"],
  ["Sofia Angels Ventures", "Sofia Angels", "angel", "Bulgaria", "meeting", 10000, 50000, "Founder event"],
  ["Seedcamp Scout", "Seedcamp", "preseed", "United Kingdom", "research", 100000, 250000, "Need pitch proof"],
  ["Speedinvest Health", "Speedinvest", "seed", "Austria", "research", 200000, 750000, "Health vertical thesis"],
  ["Vet Founder Angel", "Independent", "angel", "Netherlands", "contacted", 15000, 60000, "Animal-health angel list"],
].map(([name, firm, type, country, stage, checkMin, checkMax, intro], index) => ({
  id: `investor-${index + 1}`,
  name: name as string,
  firm: firm as string,
  type: type as Investor["type"],
  country: country as string,
  stage: stage as Investor["stage"],
  check_min: checkMin as number,
  check_max: checkMax as number,
  warm_intro_via: intro as string,
  last_touch: index % 3 === 0 ? "2026-06-07" : null,
  next_action: index % 2 === 0 ? "Send pre-seed one-pager" : "Ask for warm intro",
  notes: "Pre-seed target EUR500k; prioritize investors who understand AI workflow and regulated markets.",
}));

export const risks: Risk[] = [
  ["Missed emergency harms a pet", "safety", 2, 5, "Strict red flags, vet-reviewed evals, emergency redirect UX.", "Clinical lead", "mitigating"],
  ["Clinics churn after novelty", "execution", 3, 4, "Measure saved calls, response time, and booking conversion weekly.", "Founder", "open"],
  ["ChatGPT good-enough free alternative", "competition", 4, 3, "Win on clinic integration, safety protocol, records, and handoff.", "Product", "open"],
  ["Digitail/Lupa add client-facing AI", "competition", 4, 3, "Move faster in Bulgaria, secure design partners, deepen local workflows.", "Founder", "open"],
  ["BFSA/Vet Union pushback on AI practicing medicine", "regulatory", 2, 4, "Position as triage/admin support; maintain disclaimers and vet oversight.", "Legal", "mitigating"],
  ["Pre-seed doesn't close", "funding", 3, 5, "Run lean, build revenue proof, keep investor CRM warm.", "Founder", "open"],
  ["Founder solo-execution bottleneck", "execution", 4, 4, "Use contractors for design and QA; document operating cadence.", "Founder", "open"],
  ["Bulgarian market too small to prove model", "market", 3, 3, "Use Bulgaria for speed and safety proof; plan Romania/Greece expansion.", "GTM", "open"],
  ["AI cost per consult exceeds price", "technical", 2, 3, "Route simple asks to cheaper models and cache education content.", "AI engineer", "open"],
  ["Data protection complaint", "regulatory", 2, 4, "Minimize PHI, consent flows, DPA templates, and deletion workflow.", "Legal", "mitigating"],
].map(([title, category, likelihood, impact, mitigation, owner, status], index) => ({
  id: `risk-${index + 1}`,
  title: title as string,
  category: category as Risk["category"],
  likelihood: likelihood as number,
  impact: impact as number,
  mitigation: mitigation as string,
  owner: owner as string,
  status: status as Risk["status"],
  review_date: `2026-06-${String(14 + index).padStart(2, "0")}`,
}));

export const documents: Document[] = [
  { id: "doc-strategy", title: "Strategy doc", type: "strategy", url: "https://theveterinarian.ai/strategy", content_md: "# Strategy\n\nBuild the AI-native operating layer for pet healthcare, starting with Bulgarian clinics and expanding through clinic workflows into consumer records and insurance data.", updated_at: now },
  { id: "doc-pitch", title: "Pitch deck", type: "pitch", url: "https://theveterinarian.ai/pitch", content_md: "# Pitch deck\n\nProblem, wedge, market, product, GTM, safety, traction, team, round ask.", updated_at: now },
  { id: "doc-execution", title: "Execution plan", type: "strategy", url: "https://theveterinarian.ai/execution", content_md: "# Execution plan\n\nSeven-day sprint, CVC pilot, clinic CRM, investor cadence, and weekly KPI review.", updated_at: now },
  { id: "doc-spec", title: "Mission Control spec", type: "other", url: "", content_md: "# Mission Control\n\nInternal dashboard for creating, controlling, editing, and managing THEVETERINARIAN.AI.", updated_at: now },
];

export const decisions: Decision[] = [
  { id: "decision-1", date: "2026-06-10", title: "Start with clinic-led pilot distribution", context: "Consumer pet health apps need trust and distribution.", decision: "Use CVC Sofia as anchor to launch to existing clients.", alternatives: "Pure DTC waitlist; paid ads; vet influencer launch.", owner: "Founder" },
  { id: "decision-2", date: "2026-06-11", title: "Treat AI as triage and workflow support", context: "Regulatory and safety risk is highest around diagnosis claims.", decision: "Use disclaimers, emergency redirect, and vet handoff for clinical safety.", alternatives: "Autonomous AI diagnosis; receptionist-only assistant.", owner: "Founder" },
];

export const weekly_updates: WeeklyUpdate[] = [
  { id: "weekly-1", week_start: "2026-06-03", wins: "CVC agreed to design partner workflow. Landing copy drafted.", problems: "Safety evaluation examples still thin.", metrics_note: "Baseline KPI tracking started.", next_week: "Ship sprint day 1-3 and secure vet QA block." },
];

export const seedDatabase: Database = {
  workstreams,
  tasks,
  milestones,
  kpis,
  kpi_entries,
  clinics,
  investors,
  risks,
  documents,
  decisions,
  weekly_updates,
};
