# QONSUL Quality Diagnostic – Authoritative Workflow Contract

Status: Binding  
Scope: Website + QONSUL Cockpit  
Purpose: Prevent domain drift and preserve the complete end-to-end customer workflow across future changes.

## 1. Core principle

The QONSUL Quality Diagnostic is a standalone professional analysis domain.

It is NOT:

- a CRM Lead,
- a Contact Form,
- an Ishikawa intake,
- an analytics event,
- or merely a PDF/report.

The Quality Diagnostic may use an Ishikawa-style cause map as an analysis method and presentation.

That visual representation does NOT make the Diagnostic an Ishikawa domain record.

Canonical separation:

Quality Diagnostic != Ishikawa  
Quality Diagnostic != CRM Intake  
Quality Diagnostic != Analytics

---

## 2. Canonical customer journey

The complete intended customer workflow is:

Homepage Hero  
→ user describes a quality problem  
→ "Analyse starten"  
→ Quality Diagnostic analysis section opens  
→ browser navigates/scrolls to the cause map  
→ problem is preserved  
→ user structures causes / observations  
→ system may suggest blind spots / hypotheses  
→ user identifies available data/evidence  
→ Diagnostic consent  
→ "Diagnostic sichern"  
→ Cockpit Diagnostic is created  
→ success/reference is shown  
→ optional personal consultation  
→ separate CRM Intake  
→ Contact resolution  
→ Company resolution  
→ NEW Lead  
→ Diagnostic linked to resulting Lead where deterministically resolved

A successful Diagnostic save is NOT the end of the complete customer journey when consultation is requested.

---

## 3. Hero behaviour

When a user enters a problem in the Website Hero and selects:

"Analyse starten"

the Website MUST:

1. preserve the entered problem,
2. initialize/open the Quality Diagnostic,
3. navigate/scroll to the Quality Diagnostic cause-map section,
4. show the entered problem as the analysis starting point.

The user must not need to manually search for the analysis section.

This is a required UX behaviour, not an optional enhancement.

---

## 4. Diagnostic domain model

A Diagnostic contains professional analysis information such as:

- problem / problem statement,
- user observations / suspected causes,
- structured categories,
- system hypotheses / blind spots,
- evidence,
- available data sources,
- Diagnostic status,
- Diagnostic reference,
- consent information,
- technical metadata required for safe processing.

Problem and cause/hypothesis text may be free text.

Free text must remain professional Diagnostic data and must not automatically be copied into CRM master data or analytics.

---

## 5. Cause map semantics

The Website may present the Diagnostic through the established six-perspective cause map:

- Produkt
- Prozess
- Material
- Mensch
- Messung
- Umgebung

The cause-map/fishbone presentation is a METHOD/VIEW of the Quality Diagnostic.

It must not create an Ishikawa domain record merely because the visual method resembles an Ishikawa diagram.

Semantic mapping:

User-entered observation  
→ Diagnostic cause / observation

System-generated blind spot  
→ Diagnostic hypothesis

System-generated hypotheses are NOT confirmed causes.

The UI and persisted model must preserve this distinction.

---

## 6. Diagnostic save

Selecting:

"Diagnostic sichern"

must persist the Diagnostic through the Website's same-origin server-side integration into QONSUL Cockpit.

Canonical transport:

Browser  
→ Website same-origin API  
→ server-side signed Cockpit Diagnostic endpoint  
→ Cockpit Diagnostic domain

The Browser must never receive the Cockpit HMAC secret.

The Website must show a clear terminal result:

SUCCESS  
→ Diagnostic reference / saved confirmation

or

FAILURE  
→ appropriate German customer-facing error

The UI must never remain indefinitely in a saving state.

---

## 7. Idempotency contract

One idempotency/submission identifier represents ONE immutable logical Diagnostic payload.

Unchanged retry:  
→ same submission identity  
→ idempotent replay  
→ no duplicate Diagnostic

Changed Diagnostic payload:  
→ fresh submission identity

Payload-changing actions include at least:

- problem change,
- cause add/remove/change,
- hypothesis add/remove/change,
- evidence/data-source change,
- relevant consent change,
- "Neu beginnen".

Cockpit must remain strict and reject reuse of the same idempotency key for a different payload.

Website code must manage the submission lifecycle correctly rather than weakening Cockpit validation.

---

## 8. Diagnostic-only behaviour

A user may save a Quality Diagnostic WITHOUT requesting personal consultation.

In that case the correct result is:

Diagnostic: YES  
CRM Intake: NO  
Contact: NO  
Company: NO  
Lead: NO  
Ishikawa: NO

This is intentional.

Diagnostic creation must never depend on CRM success.

---

## 9. Optional personal consultation

After a Diagnostic has been successfully stored, the Website may offer:

"Persönliche Beratung anfragen"

This is a SEPARATE business action with separate consent.

The consultation request must not re-create or mutate the already stored Diagnostic.

Canonical flow:

Stored Diagnostic  
→ explicit consultation request  
→ CRM Intake  
→ Contact resolution  
→ Company resolution  
→ NEW Lead  
→ Diagnostic ↔ Lead

If CRM processing fails or requires review, the Diagnostic remains safely stored.

---

## 10. CRM identity resolution

CRM master entities represent identities.

Contact and Company must therefore be reused when deterministically resolved.

Contact:

unique normalized email  
→ reuse existing Contact

no unique Contact and sufficient information  
→ create Contact

ambiguous identity  
→ pending_review

Do not match people only by name.

Company:

existing resolved Contact Company  
→ preferred

otherwise unique deterministic Company match  
→ reuse

otherwise sufficient Company information  
→ create

ambiguous identity  
→ pending_review

Do not create duplicate Contacts or Companies for repeat inquiries.

Do not invent missing roles/job titles.

External intake may explicitly use an approved unknown decision-role state where defined by the CRM architecture.

---

## 11. Lead creation rule

A Lead represents a BUSINESS INQUIRY / OPPORTUNITY, not a person or company.

Therefore:

NEW unique consultation/contact/Ishikawa source event  
→ NEW Lead

even when:

- Contact already exists,
- Company already exists,
- another Lead for that Contact exists,
- another Lead for that Company exists.

Same source event retry:  
→ same result  
→ NO duplicate Lead

This distinction is mandatory.

---

## 12. Diagnostic ↔ Lead

When a Quality Diagnostic consultation resolves deterministically to CRM, the resulting Lead must be associated with the originating Diagnostic through the existing canonical relation:

diagnostics.lead_id

where the current Cockpit architecture allows deterministic association.

One Lead may have relevant Diagnostic history according to the Cockpit model.

Diagnostic-only remains valid with:

diagnostics.lead_id = null

---

## 13. Contact Form flow

The Website Contact Form is a separate source domain.

Canonical flow:

Contact Form  
→ CRM Intake  
→ Contact resolution  
→ Company resolution  
→ NEW Lead

It does NOT create a Diagnostic.

It does NOT create an Ishikawa Analysis.

Existing deterministic Contact/Company identities must be reused.

---

## 14. Ishikawa flow

Ishikawa is a separate source/domain.

Canonical flow:

Explicit Ishikawa analysis  
→ Ishikawa source record / analysis  
→ Ishikawa CRM Intake  
→ Contact resolution  
→ Company resolution  
→ NEW Lead or legitimate pending_review

It must NOT create a Quality Diagnostic automatically.

Likewise, a Quality Diagnostic must NOT create an Ishikawa domain record merely because the UI uses an Ishikawa-style cause map.

This separation is mandatory.

---

## 15. Analytics separation

Analytics observes the customer journey.

Analytics does not persist professional Diagnostic content.

Allowed examples:

- diagnostic_started
- diagnostic_completed
- controlled structural funnel events

Forbidden analytics dimensions/payloads include:

- problem text,
- cause text,
- hypothesis text,
- names,
- email addresses,
- company names,
- phone numbers,
- arbitrary form free text.

Analytics identity, CRM identity and Diagnostic identity remain separate.

---

## 16. Consent separation

The following consent purposes are separate:

- Diagnostic processing consent,
- personal consultation/contact consent,
- analytics consent,
- Ishikawa-specific processing consent where applicable.

Consent for one purpose must not silently authorize another.

The currently server-accepted Diagnostic consent version must be verified against Cockpit rather than guessed.

---

## 17. Error handling

Customer-visible states must represent the actual business state.

Examples:

Diagnostic failed before persistence:  
→ Diagnostic save error

Diagnostic successfully saved:  
→ show saved confirmation/reference

Diagnostic saved, consultation failed:  
→ Diagnostic remains shown as safely stored  
→ only consultation receives an error

CRM pending review:  
→ do not tell customer that the Diagnostic failed

Rate limit:  
→ distinguish from generic storage failure where practical

Technical validation details, HMAC information and internal CRM workflow details must not be exposed to the customer.

---

## 18. Rate limiting

Security rate limits are valid and must not be weakened in Production.

QA/Staging rate limits may be explicitly configured differently when required for repeated acceptance tests.

Any staging exception must be explicit configuration and must not activate implicitly in Production.

Rate-limit exhaustion must not be misdiagnosed as a broken Diagnostic contract.

---

## 19. UI contract

The accepted Quality Diagnostic presentation includes:

- QONSUL visual identity,
- Hero problem entry,
- automatic navigation into the analysis,
- six-perspective cause map,
- visible analysis starting point/problem,
- user causes/observations,
- visually and semantically distinct hypotheses,
- own-cause entry,
- blind-spot interaction,
- evidence/data-source section,
- Diagnostic save section,
- saved/result state,
- optional consultation section.

Future technical changes must preserve the accepted visual workflow unless a separate UX redesign is explicitly approved.

Backend/domain changes must not silently redesign the user interface.

---

## 20. Form spacing and interaction

Controls and content sections must use the established QONSUL spacing system.

No text should visually touch field or section borders.

The current accepted pattern must preserve reasonable:

- section padding,
- field padding,
- input/select height,
- button padding,
- label spacing,
- responsive behaviour.

Technical hotfixes must not regress accepted layout.

---

## 21. Company and Contact master-data behaviour

Company and Contact are authoritative CRM master-data entities.

Existing deterministic identities are reused.

For current editable forms and newly generated commercial documents, current Company master data should be used.

Already issued immutable commercial documents retain their historical snapshots.

This rule belongs to CRM/document architecture and must not be implemented by copying Company data into Diagnostic content.

---

## 22. Knowledge Base boundary

The future QONSUL Knowledge Base is NOT implemented by this contract.

Future intended architecture:

Operational Diagnostic  
→ controlled de-identification  
→ Knowledge Problem  
→ Knowledge Causes  
→ Cause Relationships  
→ similarity / ML  
→ improved blind-spot suggestions

Operational Diagnostic free text is intentionally valuable input.

However, operational CRM identifiers, analytics session IDs and unnecessary personal data must not automatically propagate into the future Knowledge Layer.

Do not introduce Knowledge Base shortcuts into the current Diagnostic flow.

---

## 23. Security boundaries

Mandatory:

- Cockpit HMAC server-side only,
- no HMAC secret in Browser bundles,
- strict idempotency,
- server-side validation,
- no unsafe identity matching,
- no Diagnostic free text in analytics,
- no Production secret exposure,
- no silent domain merging.

Origin/CORS are transport controls, not authentication.

---

## 24. Acceptance invariants

Any Quality Diagnostic change must preserve at minimum:

A. Hero  
Problem entry → Analyse starten → analysis visible.

B. Diagnostic-only  
Diagnostic created; no CRM/Lead/Ishikawa.

C. Diagnostic + consultation  
Diagnostic + separate CRM Intake → Contact/Company → NEW Lead.

D. Repeat inquiry  
Existing Contact/Company reused; NEW Lead.

E. Same source-event retry  
No duplicate Lead.

F. Ishikawa  
Ishikawa domain + CRM; no Diagnostic.

G. Contact Form  
CRM; no Diagnostic/Ishikawa.

H. Idempotency  
Changed payload never reuses stale immutable request identity.

I. Analytics  
No professional Diagnostic free text.

J. Security  
Browser never receives server-side signing secret.

---

## 25. Change-control rule

Before modifying Quality Diagnostic code, an agent must determine which sections of this contract are affected.

After modification, the agent must explicitly state:

- which contract sections were touched,
- which invariants were regression-tested,
- whether domain boundaries changed.

If a requested implementation conflicts with this contract:

STOP.

Do not silently reinterpret the workflow.

Request explicit architectural approval.

---

## 26. Production rule

Passing local or isolated Staging acceptance does NOT authorize Production deployment.

Production changes require separate explicit approval.

---

## 27. Source-of-truth rule

This file is the authoritative workflow-level specification for the Quality Diagnostic.

Implementation details remain authoritative in their respective codebases, but implementation must conform to this workflow contract.

If Website and Cockpit behaviour disagree with this document, the discrepancy must be reported rather than silently resolved by changing business semantics.
