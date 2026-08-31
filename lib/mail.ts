import {escapeHtml} from './report';
import {rawDb,setting} from './server';
import type {ContactLead} from './crm';

export async function sendContactSummary(lead:ContactLead){
  const apiKey=setting('RESEND_API_KEY'),from=setting('CONTACT_FROM_EMAIL'),to=setting('PUBLIC_CONTACT_EMAIL');
  if(setting('PRODUCTION_READY')!=='true'||!apiKey||!from||!to)return 'not_configured';
  const db=rawDb();
  const claimed=await db.prepare("UPDATE contact_requests SET email_status = 'sending' WHERE id = ? AND email_status = 'pending' RETURNING id").bind(lead.id).first();
  if(!claimed)return 'pending';
  try{
    const e=escapeHtml;
    const html=`<h1>Neue Kontaktanfrage über qonsul.de</h1><p><strong>Name:</strong> ${e(lead.name)}<br><strong>E-Mail:</strong> ${e(lead.email)}${lead.phone?`<br><strong>Telefon:</strong> ${e(lead.phone)}`:''}${lead.company?`<br><strong>Unternehmen:</strong> ${e(lead.company)}`:''}</p><h2>Nachricht</h2><p>${e(lead.message).replace(/\n/g,'<br>')}</p><p><small>Interne Referenz: ${e(lead.id)}</small></p>`;
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(5000),headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`qonsul-contact/${lead.id}`},body:JSON.stringify({from,to:[to],reply_to:lead.email,subject:`Neue QONSUL Kontaktanfrage · ${lead.name.replace(/[\r\n]/g,' ').slice(0,80)}`,html})});
    if(!response.ok)throw new Error(`Mail ${response.status}`);
    const result=await response.json() as {id?:string};
    await db.prepare("UPDATE contact_requests SET email_provider_id = ?, email_status = 'sent' WHERE id = ?").bind(result.id||null,lead.id).run();
    return 'sent';
  }catch{
    // Timeouts may occur after acceptance; the idempotency key prevents duplicates during manual reconciliation.
    await db.prepare("UPDATE contact_requests SET email_status = 'needs_review' WHERE id = ?").bind(lead.id).run();
    return 'needs_review';
  }
}
