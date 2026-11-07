import { type Analysis } from './analysis';
import { CONTACT_PRIVACY_VERSION } from './contact';
import { deliverIntake } from './cockpit-intake-client';
import { isCockpitIntakeConfigured } from './cockpit-intake-config';
import { rawDb, setting } from './server';

export type Lead = { id: string; name: string; email: string; company: string; analysis: Analysis };
export type ContactLead = { id: string; name: string; email: string; phone: string; company: string; message: string };

const intakeOptions = () => ({
  baseUrl: setting('QONSUL_COCKPIT_INTAKE_URL'),
  secret: setting('QONSUL_COCKPIT_INTAKE_SECRET'),
});

function cockpitReady() {
  return setting('PRODUCTION_READY') === 'true' && isCockpitIntakeConfigured(intakeOptions());
}

function truncate(value: string, max = 2000) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function reportMessage(lead: Lead) {
  const causes = lead.analysis.causes
    .map(cause => `- ${cause.category}: ${cause.text}`)
    .join('\n');
  const data = lead.analysis.availableData?.join(', ') || 'Keine Angaben';
  return truncate([
    'Beratungsanfrage zur Ishikawa-Analyse',
    '',
    `Problem: ${lead.analysis.problem}`,
    `Analysemodus: ${lead.analysis.mode}`,
    `Verfügbare Daten: ${data}`,
    '',
    'Hypothesen:',
    causes || '- Keine Hypothesen übermittelt.',
  ].join('\n'));
}

async function markDelivered(table: 'reports' | 'contact_requests', id: string, reference: string) {
  // The legacy reference column is retained so existing D1 data needs no migration.
  await rawDb().prepare(`UPDATE ${table} SET crm_note_id = ?, crm_status = 'sent' WHERE id = ?`).bind(reference, id).run();
}

async function markNeedsReview(table: 'reports' | 'contact_requests', id: string) {
  await rawDb().prepare(`UPDATE ${table} SET crm_status = 'needs_review' WHERE id = ?`).bind(id).run();
}

export async function syncLead(lead: Lead) {
  if (!cockpitReady()) return 'not_configured';
  const db = rawDb();
  const claimed = await db.prepare("UPDATE reports SET crm_status = 'sending' WHERE id = ? AND crm_status = 'pending' RETURNING id").bind(lead.id).first();
  if (!claimed) return 'pending';
  try {
    const delivery = await deliverIntake('contact', {
      source_event_id: lead.id,
      submitted_at: new Date().toISOString(),
      payload_schema_version: '1.0',
      contact: { name: lead.name, email: lead.email, phone: null },
      company: { name: lead.company },
      payload: { message: reportMessage(lead) },
      consent: { privacy_acknowledged: true, privacy_version: CONTACT_PRIVACY_VERSION },
    }, intakeOptions());
    await markDelivered('reports', lead.id, delivery.reference);
    return 'sent';
  } catch {
    // The signed source event ID makes a later manual retry idempotent.
    await markNeedsReview('reports', lead.id);
    return 'needs_review';
  }
}

export async function syncContactLead(lead: ContactLead) {
  if (!cockpitReady()) return 'not_configured';
  const db = rawDb();
  const claimed = await db.prepare("UPDATE contact_requests SET crm_status = 'sending' WHERE id = ? AND crm_status = 'pending' RETURNING id").bind(lead.id).first();
  if (!claimed) return 'pending';
  try {
    const delivery = await deliverIntake('contact', {
      source_event_id: lead.id,
      submitted_at: new Date().toISOString(),
      payload_schema_version: '1.0',
      contact: { name: lead.name, email: lead.email, phone: lead.phone || null },
      company: { name: lead.company },
      payload: { message: lead.message },
      consent: { privacy_acknowledged: true, privacy_version: CONTACT_PRIVACY_VERSION },
    }, intakeOptions());
    await markDelivered('contact_requests', lead.id, delivery.reference);
    return 'sent';
  } catch {
    await markNeedsReview('contact_requests', lead.id);
    return 'needs_review';
  }
}
