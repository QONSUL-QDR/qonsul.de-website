import type {Analysis} from './analysis';
import {deliverIntake,IntakeDeliveryError,type IntakeEvent} from './cockpit-intake-client';
import {ishikawaSourceCauseId} from './ishikawa-source-id';
import {rawDb,setting} from './server';

export type DeliveryStatus='sent'|'pending'|'needs_review'|'not_configured'|'not_requested';
export type ContactLead={id:string;name:string;email:string;phone:string;company:string;message:string;privacyVersion:string;submittedAt:number;analyticsSessionId?:string|null;diagnosticFlowId?:string|null};
export type IshikawaLead={id:string;name:string;email:string;company:string;analysis:Analysis;consentVersion:string;submittedAt:number;analyticsSessionId?:string|null;diagnosticFlowId?:string|null};

function options(){return {baseUrl:setting('QONSUL_COCKPIT_INTAKE_URL'),secret:setting('QONSUL_COCKPIT_INTAKE_SECRET')};}
export function cockpitConfigured(){const value=options();return !!value.baseUrl&&value.secret.length>=32;}

function auditDelivery(source:'contact'|'ishikawa',sourceEventId:string,outcome:DeliveryStatus,details:{httpStatus?:number|null;kind?:string}={}){
  console.info(JSON.stringify({event:'qonsul.website_intake_delivery',source,source_event_id:sourceEventId,target_path:`/api/v1/intake/${source}`,http_status:details.httpStatus??null,delivery_status:outcome,retry_classification:outcome==='pending'?'transient':'not_retryable',failure_kind:details.kind??null}));
}

async function send(source:'contact'|'ishikawa',event:IntakeEvent):Promise<DeliveryStatus>{
  if(setting('PRODUCTION_READY')!=='true'){auditDelivery(source,event.source_event_id,'not_configured');return 'not_configured';}
  if(!cockpitConfigured()){auditDelivery(source,event.source_event_id,'needs_review',{kind:'configuration'});return 'needs_review';}
  try{const delivery=await deliverIntake(source,event,options());auditDelivery(source,event.source_event_id,'sent',{httpStatus:delivery.httpStatus});return 'sent';}
  catch(error){const outcome=error instanceof IntakeDeliveryError&&error.transient?'pending':'needs_review';auditDelivery(source,event.source_event_id,outcome,{httpStatus:error instanceof IntakeDeliveryError?error.httpStatus:null,kind:error instanceof IntakeDeliveryError?error.kind:'transport'});return outcome;}
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
