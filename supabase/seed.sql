insert into workstreams (id, name, color, icon) values
('ws-product','Product','#0E9594','rocket'),
('ws-clinical','Clinical','#22C55E','stethoscope'),
('ws-gtm','GTM','#E3B23C','megaphone'),
('ws-fundraising','Fundraising','#A855F7','landmark'),
('ws-regulatory','Regulatory','#EF4444','shield'),
('ws-data-ai','Data/AI','#3B82F6','brain')
on conflict (id) do update set name = excluded.name, color = excluded.color, icon = excluded.icon;

insert into tasks (id,title,description,workstream_id,status,priority,sprint_day,due_date,owner,tags,created_at,updated_at,sort_order) values
('task-1','Register company checklist','Confirm incorporation, accountant, bank, and founder admin steps.','ws-regulatory','doing','P0',1,'2026-06-11','Founder','{launch-critical}',now(),now(),1),
('task-2','Landing page live on theveterinarian.ai','Waitlist and clinic interest forms.','ws-gtm','doing','P0',1,'2026-06-11','Product lead','{launch-critical}',now(),now(),2),
('task-3','Brand kit','Logo, palette, and usage rules.','ws-product','todo','P1',1,'2026-06-11','Vet advisor','{ops}',now(),now(),3),
('task-4','Legal disclaimers EN/BG','Triage-not-diagnosis language and emergency redirect copy.','ws-regulatory','todo','P0',1,'2026-06-11','AI engineer','{launch-critical}',now(),now(),4),
('task-5','Analytics (PostHog) wired','Track waitlist, clinic interest, consult start, and escalation events.','ws-data-ai','todo','P1',1,'2026-06-11','Founder','{ops}',now(),now(),5),
('task-6','Pet profile + auth','Email/phone OTP, pet basics, consent flags, and record starter.','ws-product','todo','P0',2,'2026-06-12','Product lead','{pilot}',now(),now(),6),
('task-7','AI vet chat v1','Claude API integration with triage system prompt.','ws-data-ai','todo','P0',2,'2026-06-12','Vet advisor','{pilot}',now(),now(),7),
('task-8','Red-flag emergency ruleset v1','24 presentations trigger clinic-now guidance.','ws-clinical','todo','P0',2,'2026-06-12','AI engineer','{pilot}',now(),now(),8),
('task-9','Multimodal input','Photo upload path into chat and structured image notes.','ws-product','todo','P0',3,'2026-06-13','Founder','{pilot}',now(),now(),9),
('task-10','Bulgarian language QA pass with vets','Review emergency copy and clinic handoff text.','ws-clinical','todo','P0',3,'2026-06-13','Product lead','{pilot}',now(),now(),10),
('task-11','Conversation history + handoff summary generator','Summaries for escalated cases.','ws-data-ai','todo','P1',3,'2026-06-13','Vet advisor','{ops}',now(),now(),11),
('task-12','Clinic console v1','Escalated chats queue and booking requests inbox.','ws-product','todo','P0',4,'2026-06-14','AI engineer','{pilot}',now(),now(),12),
('task-13','White-label config','Clinic name, logo, hours, emergency contacts.','ws-product','todo','P1',4,'2026-06-14','Founder','{ops}',now(),now(),13),
('task-14','Booking request to email/SMS flow','Clinic receives structured request with owner and pet context.','ws-gtm','todo','P0',4,'2026-06-14','Product lead','{pilot}',now(),now(),14),
('task-15','Pilot onboarding with Central Veterinary Clinic Sofia','Train 3 vets and define daily feedback rhythm.','ws-clinical','todo','P0',5,'2026-06-15','Vet advisor','{pilot}',now(),now(),15),
('task-16','Vet feedback rubric','Approve/correct each AI answer with issue taxonomy.','ws-clinical','todo','P0',5,'2026-06-15','AI engineer','{pilot}',now(),now(),16),
('task-17','Safety eval set v1','Run and score 100 scripted cases.','ws-data-ai','todo','P0',5,'2026-06-15','Founder','{pilot}',now(),now(),17),
('task-18','Fix list from vet review','Patch launch blockers from first scored review session.','ws-product','todo','P0',6,'2026-06-16','Product lead','{pilot}',now(),now(),18),
('task-19','Rate limiting + abuse guards','Protect chat and upload endpoints.','ws-data-ai','todo','P1',6,'2026-06-16','Vet advisor','{ops}',now(),now(),19),
('task-20','Uptime monitor + error alerting','External monitor, alerts, and error budget dashboard.','ws-data-ai','todo','P1',6,'2026-06-16','AI engineer','{ops}',now(),now(),20),
('task-21','App Store-less PWA polish','Installable branded mobile web experience.','ws-product','todo','P2',6,'2026-06-16','Founder','{ops}',now(),now(),21),
('task-22','Soft launch to 200 clinic clients','CVC sends SMS/email invitation.','ws-gtm','todo','P0',7,'2026-06-17','Product lead','{pilot}',now(),now(),22),
('task-23','Founder demo video recorded','Two-minute product and clinic-console walkthrough.','ws-gtm','todo','P1',7,'2026-06-17','Vet advisor','{ops}',now(),now(),23),
('task-24','Day-7 retro + metrics snapshot','Document learnings, KPI baseline, safety issues, and next sprint.','ws-product','todo','P1',7,'2026-06-17','AI engineer','{ops}',now(),now(),24),
('task-25','Pre-seed one-pager sent to 10 angels','Target warm angels and CEE funds.','ws-fundraising','todo','P0',7,'2026-06-17','Founder','{pilot}',now(),now(),25)
on conflict (id) do nothing;

insert into milestones (id,title,target_date,phase,status,description) values
('ms-pilot-live','Pilot live','2026-06-30','pilot','at_risk','CVC Sofia pilot launched with safety review loop.'),
('ms-10-clinics','10 paying clinics','2026-09-30','pilot','pending','First repeatable clinic sales motion.'),
('ms-1000-mau','1,000 consumer MAU','2026-10-15','pilot','pending','Consumer demand signal.'),
('ms-preseed','Pre-seed EUR500k closed','2026-10-31','pilot','pending','Capital for Bulgaria scale-up.'),
('ms-bg-scale','60 clinics + 25k MAU + EUR500k ARR run-rate','2027-06-30','bulgaria','pending','National category leadership proof.'),
('ms-seed','Seed EUR3M','2027-09-30','bulgaria','pending','Finance regional expansion.'),
('ms-eu-launch','Romania+Greece launch','2027-12-15','eu','pending','Neighbor market launch.'),
('ms-uk-a','UK entry + Series A $15-20M','2028-09-30','eu','pending','High-ARPU English market.'),
('ms-us','US entry','2029-03-31','us','pending','US launch.'),
('ms-mga','Insurance MGA pilot','2029-06-30','insurance','pending','Underwriting partner pilot.'),
('ms-unicorn','$25-40M ARR / unicorn round','2029-12-31','insurance','pending','Growth round.'),
('ms-decacorn','Decacorn checkpoint','2031-12-31','insurance','pending','Global category leadership checkpoint.')
on conflict (id) do nothing;

insert into kpis (id,key,label,unit,category,target_y1,sort_order) values
('kpi-pets_um','pets_um','Pets under management','count','product',30000,0),
('kpi-clinics_paying','clinics_paying','Paying clinics','count','commercial',60,1),
('kpi-mrr','mrr','MRR','EUR','financial',41000,2),
('kpi-mau','mau','Consumer MAU','count','product',25000,3),
('kpi-consults_wk','consults_wk','AI consults / week','count','product',4000,4),
('kpi-escalation_rate','escalation_rate','Escalation to vet rate','%','clinical_safety',22,5),
('kpi-missed_emergency','missed_emergency','Missed emergency rate','%','clinical_safety',0,6),
('kpi-vet_approval','vet_approval','Vet approval of AI answers','%','clinical_safety',95,7),
('kpi-nps','nps','Pet-owner NPS','score','product',60,8),
('kpi-cac_clinic','cac_clinic','CAC per clinic','EUR','commercial',400,9),
('kpi-churn_clinic','churn_clinic','Monthly clinic churn','%','commercial',1.5,10),
('kpi-runway','runway','Runway','months','financial',12,11)
on conflict (id) do nothing;

with vals(kpi_id, values) as (
  values
  ('kpi-pets_um', array[120,210,320,470,650,880,1150,1450]::numeric[]),
  ('kpi-clinics_paying', array[0,0,0,1,1,1,2,2]::numeric[]),
  ('kpi-mrr', array[0,0,0,250,400,550,900,1200]::numeric[]),
  ('kpi-mau', array[40,65,90,130,190,270,380,520]::numeric[]),
  ('kpi-consults_wk', array[8,16,28,45,72,106,155,220]::numeric[]),
  ('kpi-escalation_rate', array[38,35,33,31,29,27,25,24]::numeric[]),
  ('kpi-missed_emergency', array[0,0,0,0,0,0,0,0]::numeric[]),
  ('kpi-vet_approval', array[74,78,81,84,86,88,90,91]::numeric[]),
  ('kpi-nps', array[18,24,28,34,38,42,47,51]::numeric[]),
  ('kpi-cac_clinic', array[900,800,720,650,590,530,485,450]::numeric[]),
  ('kpi-churn_clinic', array[0,0,0,0,0,0,0,0]::numeric[]),
  ('kpi-runway', array[6,6,5.8,5.6,5.4,5.2,5,4.8]::numeric[])
)
insert into kpi_entries (id,kpi_id,date,value,note)
select 'entry-' || replace(kpi_id,'kpi-','') || '-' || i, kpi_id, date '2026-04-17' + ((i - 1) * 7), values[i], 'Weekly seed'
from vals, generate_subscripts(values, 1) as i
on conflict (id) do nothing;

insert into clinics (id,name,city,country,contact_name,contact_email,phone,stage,mrr,vets_count,notes,last_touch,next_action,next_action_date) values
('clinic-1','Central Veterinary Clinic','Sofia','Bulgaria','Dr. Elena Petrova','contact1@clinic.example','+359 870000000','pilot',0,12,'Anchor design partner; founder relationship.','2026-06-01','Schedule daily pilot feedback standup','2026-06-12'),
('clinic-2','Blue Cross Vet Center','Sofia','Bulgaria','Dr. Ivan Petrov','contact2@clinic.example','+359 870013719','demo',0,7,'Interested in after-hours receptionist.','2026-06-02','Send clinic AI Staff one-pager','2026-06-13'),
('clinic-3','Animed 24','Sofia','Bulgaria','Dr. Maria Dimitrova','contact3@clinic.example','+359 870027438','contacted',0,5,'Needs emergency triage workflow.','2026-06-03','Send clinic AI Staff one-pager','2026-06-14'),
('clinic-4','Vet Family Clinic','Sofia','Bulgaria','Dr. Georgi Ivanov','contact4@clinic.example','+359 870041157','lead',0,4,'Small-animal practice near Lozenets.',null,'Send clinic AI Staff one-pager','2026-06-15'),
('clinic-5','Nova Vet Plovdiv','Plovdiv','Bulgaria','Dr. Nikolay Kolev','contact5@clinic.example','+359 870054876','demo',0,6,'Asked for Bulgarian examples.','2026-06-05','Send clinic AI Staff one-pager','2026-06-16')
on conflict (id) do nothing;

insert into investors (id,name,firm,type,country,stage,check_min,check_max,warm_intro_via,last_touch,next_action,notes) values
('investor-1','Eleven Ventures','Eleven Ventures','preseed','Bulgaria','contacted',50000,200000,'Founder network','2026-06-07','Send pre-seed one-pager','Pre-seed target EUR500k.'),
('investor-2','LAUNCHub Ventures','LAUNCHub Ventures','preseed','Bulgaria','research',100000,300000,'Portfolio founder intro',null,'Ask for warm intro','Pre-seed target EUR500k.'),
('investor-3','Vitosha Venture Partners','Vitosha Venture Partners','preseed','Bulgaria','meeting',50000,250000,'CVC advisor',null,'Send pre-seed one-pager','Pre-seed target EUR500k.'),
('investor-4','BrightCap Ventures','BrightCap','seed','Bulgaria','research',150000,500000,'Need warm intro','2026-06-07','Ask for warm intro','Pre-seed target EUR500k.'),
('investor-5','Payhawk Angel 1','TBD via Payhawk network','angel','Bulgaria','contacted',10000,50000,'Payhawk network',null,'Send pre-seed one-pager','Pre-seed target EUR500k.')
on conflict (id) do nothing;

insert into risks (id,title,category,likelihood,impact,mitigation,owner,status,review_date) values
('risk-1','Missed emergency harms a pet','safety',2,5,'Strict red flags, vet-reviewed evals, emergency redirect UX.','Clinical lead','mitigating','2026-06-14'),
('risk-2','Clinics churn after novelty','execution',3,4,'Measure saved calls and response time weekly.','Founder','open','2026-06-15'),
('risk-3','ChatGPT good-enough free alternative','competition',4,3,'Win on clinic integration and safety protocol.','Product','open','2026-06-16'),
('risk-4','Digitail/Lupa add client-facing AI','competition',4,3,'Move faster in Bulgaria and secure design partners.','Founder','open','2026-06-17'),
('risk-5','BFSA/Vet Union pushback on AI practicing medicine','regulatory',2,4,'Position as triage/admin support with vet oversight.','Legal','mitigating','2026-06-18'),
('risk-6','Pre-seed does not close','funding',3,5,'Run lean, build revenue proof, keep investor CRM warm.','Founder','open','2026-06-19'),
('risk-7','Founder solo-execution bottleneck','execution',4,4,'Use contractors and document cadence.','Founder','open','2026-06-20'),
('risk-8','Bulgarian market too small to prove model','market',3,3,'Use Bulgaria for speed and plan Romania/Greece.','GTM','open','2026-06-21'),
('risk-9','AI cost per consult exceeds price','technical',2,3,'Route simple asks to cheaper models and cache content.','AI engineer','open','2026-06-22'),
('risk-10','Data protection complaint','regulatory',2,4,'Minimize PHI, consent flows, DPA templates, deletion workflow.','Legal','mitigating','2026-06-23')
on conflict (id) do nothing;

insert into documents (id,title,type,url,content_md,updated_at) values
('doc-strategy','Strategy doc','strategy','https://theveterinarian.ai/strategy','# Strategy\n\nBuild the AI-native operating layer for pet healthcare.',now()),
('doc-pitch','Pitch deck','pitch','https://theveterinarian.ai/pitch','# Pitch deck\n\nProblem, wedge, product, GTM, safety, traction, round ask.',now()),
('doc-execution','Execution plan','strategy','https://theveterinarian.ai/execution','# Execution plan\n\nSeven-day sprint, CVC pilot, clinic CRM, investor cadence.',now()),
('doc-spec','Mission Control spec','other','','# Mission Control\n\nInternal dashboard for THEVETERINARIAN.AI.',now())
on conflict (id) do nothing;

insert into decisions (id,date,title,context,decision,alternatives,owner) values
('decision-1','2026-06-10','Start with clinic-led pilot distribution','Consumer pet health apps need trust and distribution.','Use CVC Sofia as anchor to launch to existing clients.','Pure DTC waitlist; paid ads; vet influencer launch.','Founder'),
('decision-2','2026-06-11','Treat AI as triage and workflow support','Regulatory and safety risk is highest around diagnosis claims.','Use disclaimers, emergency redirect, and vet handoff for clinical safety.','Autonomous AI diagnosis; receptionist-only assistant.','Founder')
on conflict (id) do nothing;

insert into weekly_updates (id,week_start,wins,problems,metrics_note,next_week) values
('weekly-1','2026-06-03','CVC agreed to design partner workflow. Landing copy drafted.','Safety evaluation examples still thin.','Baseline KPI tracking started.','Ship sprint day 1-3 and secure vet QA block.')
on conflict (id) do nothing;
