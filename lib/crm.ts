import type {Analysis} from './analysis';
import {deliverIntake,IntakeDeliveryError,type IntakeEvent} from './cockpit-intake-client';
import {ishikawaSourceCauseId} from './ishikawa-source-id';
import {rawDb,setting} from './server';

export type DeliveryStatus='sent'|'pending'|'needs_review'|'not_configured'|'not_requested';
export type ContactLead={id:string;name:string;email:string;phone:string;company:string;message:string;privacyVersion:string;submittedAt:number;analyticsSessionId?:string|null;diagnosticFlowId?:string|null};
export type IshikawaLead={id:string;name:string;email:string;company:string;analysis:Analysis;consentVersion:string;submittedAt:number;analyticsSessionId?:string|null;diagnosticFlowId?:string|null};

function options(){return {baseUrl:setting('QONSUL_COCKPIT_INTAKE_URL'),secret:setting('QONSUL_COCKPIT_INTAKE_SECRET')};}
export function cockpitConfigured(){const value=options();return !!value.baseUrl&&value.secret.length>=32;}

async function send(source:'contact'|'ishikawa',event:IntakeEvent):Promise<DeliveryStatus>{
  if(setting('PRODUCTION_READY')!=='true')return 'not_configured';
  if(!cockpitConfigured())return 'needs_review';
  try{await deliverIntake(source,event,options());return 'sent';}
  catch(error){return error instanceof IntakeDeliveryError&&error.transient?'pending':'needs_review';}
}

export async function syncContactLead(lead:ContactLead):Promise<DeliveryStatus>{
  const db=rawDb();
  const claimed=await db.prepare("UPDATE contact_requests SET crm_status = 'sending' WHERE id = ? AND crm_status = 'pending' RETURNING id").bind(lead.id).first();
  if(!claimed)return (await db.prepare('SELECT crm_status FROM contact_requests WHERE id = ?').bind(lead.id).first<{crm_status:DeliveryStatus}>())?.crm_status||'needs_review';
  const result=await send('contact',{
    source_event_id:lead.id,submitted_at:new Date(lead.submittedAt).toISOString(),payload_schema_version:'1.0',
    contact:{name:lead.name,email:lead.email,phone:lead.phone||null},company:{name:lead.company||null},payload:{message:lead.message},
    consent:{privacy_acknowledged:true,privacy_version:lead.privacyVersion},analytics_session_id:lead.analyticsSessionId||null,diagnostic_flow_id:lead.diagnosticFlowId||null,
  });
  await db.prepare('UPDATE contact_requests SET crm_status = ? WHERE id = ?').bind(result,lead.id).run();
  return result;
}

export async function syncLead(lead:IshikawaLead):Promise<DeliveryStatus>{
  const db=rawDb();
  const claimed=await db.prepare("UPDATE reports SET crm_status = 'sending' WHERE id = ? AND crm_status = 'pending' RETURNING id").bind(lead.id).first();
  if(!claimed)return (await db.prepare('SELECT crm_status FROM reports WHERE id = ?').bind(lead.id).first<{crm_status:DeliveryStatus}>())?.crm_status||'needs_review';
  const causes=await Promise.all(lead.analysis.causes.map(async cause=>({...cause,id:await ishikawaSourceCauseId(lead.id,cause.id)})));
  const result=await send('ishikawa',{
    source_event_id:lead.id,submitted_at:new Date(lead.submittedAt).toISOString(),payload_schema_version:'1.0',
    contact:{name:lead.name,email:lead.email},company:{name:lead.company},
    payload:{problem:lead.analysis.problem,mode:lead.analysis.mode,available_data:lead.analysis.availableData||[],causes},
    consent:{storage_granted:true,contact_requested:true,consent_version:lead.consentVersion},analytics_session_id:lead.analyticsSessionId||null,diagnostic_flow_id:lead.diagnosticFlowId||null,
  });
  await db.prepare('UPDATE reports SET crm_status = ? WHERE id = ?').bind(result,lead.id).run();
  return result;
}
