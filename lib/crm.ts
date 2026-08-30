import { escapeHtml } from './report';
import { CATEGORIES, type Analysis } from './analysis';
import { rawDb, setting } from './server';
export type Lead = {id:string;name:string;email:string;company:string;analysis:Analysis};
async function hubspot(path:string,method:string,body?:unknown){
  const response=await fetch(`https://api.hubspot.com${path}`,{method,signal:AbortSignal.timeout(4000),headers:{Authorization:`Bearer ${setting('HUBSPOT_ACCESS_TOKEN')}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error(`CRM ${response.status}`);
  return response.status===204?{}:await response.json() as Record<string,unknown>;
}
export async function syncLead(lead:Lead){
  if(setting('PRODUCTION_READY')!=='true'||!setting('HUBSPOT_ACCESS_TOKEN'))return 'not_configured';
  const db=rawDb();
  // Atomic claim prevents repeated form submissions from duplicating CRM notes.
  const claimed=await db.prepare("UPDATE reports SET crm_status = 'sending' WHERE id = ? AND crm_status = 'pending' RETURNING id").bind(lead.id).first();
  if(!claimed)return 'pending';
  try{
    const found=await hubspot('/crm/v3/objects/contacts/search','POST',{filterGroups:[{filters:[{propertyName:'email',operator:'EQ',value:lead.email}]}],limit:1});
    const existing=found.results as {id:string}[]|undefined;
    let contactId=existing?.[0]?.id;
    if(!contactId){const [firstname,...rest]=lead.name.split(' ');const created=await hubspot('/crm/v3/objects/contacts','POST',{properties:{email:lead.email,firstname,lastname:rest.join(' '),company:lead.company}});contactId=String(created.id);}
    await db.prepare('UPDATE reports SET crm_contact_id = ? WHERE id = ?').bind(contactId,lead.id).run();
    const e=escapeHtml;
    const note=`<h2>QONSUL · Quality Diagnostic</h2><p><strong>${e(lead.analysis.problem)}</strong></p><p>Unternehmen: ${e(lead.company)} · Kontakt zur Analyse ausdrücklich gewünscht.</p><p>Hypothesen, keine bestätigten Ursachen. Analyse-Modus: ${lead.analysis.mode}.</p><p>Datentypen laut Selbstauskunft: ${(lead.analysis.availableData||[]).map(e).join(", ")||"Keine markiert"}. Keine Messdaten analysiert.</p>${CATEGORIES.map(c=>`<h3>${c}</h3><ul>${lead.analysis.causes.filter(x=>x.category===c).map(x=>`<li>[${x.source==='user'?'Beobachtung':x.source==='ai'?'KI':'Regelkatalog'}] ${e(x.text)}${x.check?` — Prüfen: ${e(x.check)}`:''}${x.data?.length?` — Benötigte Daten: ${x.data.map(e).join(", ")}`:""}${x.metric?` (${e(x.metric)})`:''}</li>`).join('')}</ul>`).join('')}<p>Interne Referenz: ${e(lead.id)}</p>`;
    const createdNote=await hubspot('/crm/v3/objects/notes','POST',{properties:{hs_timestamp:new Date().toISOString(),hs_note_body:note},associations:[{to:{id:contactId},types:[{associationCategory:'HUBSPOT_DEFINED',associationTypeId:202}]}]});
    await db.prepare("UPDATE reports SET crm_note_id = ?, crm_status = 'sent' WHERE id = ?").bind(String(createdNote.id),lead.id).run();
    return 'sent';
  }catch{
    // A timeout may occur after HubSpot accepted a note. Avoid blind automatic retries.
    await db.prepare("UPDATE reports SET crm_status = 'needs_review' WHERE id = ?").bind(lead.id).run();
    return 'needs_review';
  }
}
