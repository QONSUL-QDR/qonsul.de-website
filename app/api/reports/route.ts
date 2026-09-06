import { CATEGORIES, CONSENT_VERSION, parseAnalysis, type Analysis } from '@/lib/analysis';
import { hash,json,purgeExpired,rateLimit,rawDb,readBody,setting } from '@/lib/server';
import {syncLead} from '@/lib/crm';
import {reportHtml} from '@/lib/report';
const optionalUuid=(value:unknown,label:string):string|null=>{
  if(value==null)return null;
  if(typeof value!=='string'||!/^[0-9a-f-]{36}$/i.test(value))throw new Error(`Ungültige ${label}.`);
  return value;
};
export async function POST(request:Request){
  try{
    const body=await readBody(request);const analysis=parseAnalysis(body.analysis);
    if(!analysis.causes.length) return json({error:'Bitte mindestens eine Ursache ergänzen.'},400);
    const str=(key:string,max:number)=>{const v=body[key];if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`Bitte ${key==='name'?'Ihren Namen':key==='company'?'Ihr Unternehmen':'eine gültige E-Mail'} angeben.`);return v.trim();};
    const name=str('name',100),email=str('email',254).toLowerCase(),company=str('company',150);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Bitte eine gültige E-Mail-Adresse angeben.');
    if(body.storageConsent!==true||body.consentVersion!==CONSENT_VERSION)throw new Error('Bitte die Speicherung für den Report ausdrücklich bestätigen.');
    if(setting('PRODUCTION_READY')!=='true'&&body.demoConfirmed!==true)throw new Error('In der privaten Vorschau bitte nur Testdaten verwenden und dies bestätigen.');
    if(body.website)throw new Error('Anfrage abgelehnt.');
    if(typeof body.reportToken!=='string'||!/^[a-f0-9-]{72}$/.test(body.reportToken))throw new Error('Ungültiger Report-Schlüssel.');
    const analyticsSessionId=optionalUuid(body.analyticsSessionId,'Analytics-Sitzung'),diagnosticFlowId=optionalUuid(body.diagnosticFlowId,'Diagnosefluss');
    const tokenHash=await hash(body.reportToken);const db=rawDb();await purgeExpired();
    const existing=await db.prepare('SELECT id, analysis, name, email, company, consent_version, consent_at, analytics_session_id, diagnostic_flow_id, crm_consent, crm_status FROM reports WHERE token_hash = ?').bind(tokenHash).first<{id:string;analysis:string;name:string;email:string;company:string;consent_version:string;consent_at:number;analytics_session_id:string|null;diagnostic_flow_id:string|null;crm_consent:number;crm_status:string}>();
    if(existing){const finalStatus=existing.crm_consent&&existing.crm_status==='pending'?await syncLead({id:existing.id,name:existing.name,email:existing.email,company:existing.company,analysis:JSON.parse(existing.analysis) as Analysis,consentVersion:existing.consent_version,submittedAt:existing.consent_at,analyticsSessionId:existing.analytics_session_id,diagnosticFlowId:existing.diagnostic_flow_id}):existing.crm_status;if(setting('PRODUCTION_READY')==='true'&&existing.crm_consent&&finalStatus!=='sent')return json({error:'Der Report ist sicher vorgemerkt, die Beratungsanfrage aber noch nicht bestätigt. Bitte erneut versuchen.'},503);return json({url:`/report#${body.reportToken}`,status:'accepted',reference:existing.id,consultationRequested:!!existing.crm_consent,expiresInDays:30});}
    if(!await rateLimit(request,'report',8))return json({error:'Zu viele gespeicherte Reports. Bitte später erneut versuchen.'},429);
    const id=crypto.randomUUID(),now=Date.now(),crmConsent=body.crmConsent===true;
    const crmStatus=!crmConsent?'not_requested':setting('PRODUCTION_READY')==='true'?'pending':'not_configured';
    const statements=[db.prepare('INSERT INTO reports (id, token_hash, analysis, name, email, company, consent_version, consent_at, analytics_session_id, diagnostic_flow_id, crm_consent, crm_status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id,tokenHash,JSON.stringify(analysis),name,email,company,CONSENT_VERSION,now,analyticsSessionId,diagnosticFlowId,crmConsent?1:0,crmStatus,now,now+30*86400000)];
    if(body.trendConsent===true){const date=new Date();const quarter=`${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth()/3)+1}`;for(const category of CATEGORIES){const count=analysis.causes.filter(c=>c.category===category).length;if(count)statements.push(db.prepare('INSERT INTO trends (key, category, quarter, count) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET count = count + excluded.count').bind(`${quarter}-${category}`,category,quarter,count));}}
    await db.batch(statements);
    const finalStatus=crmStatus==='pending'?await syncLead({id,name,email,company,analysis,consentVersion:CONSENT_VERSION,submittedAt:now,analyticsSessionId,diagnosticFlowId}):crmStatus;
    if(setting('PRODUCTION_READY')==='true'&&crmConsent&&finalStatus!=='sent')return json({error:'Der Report ist sicher vorgemerkt, die Beratungsanfrage aber noch nicht bestätigt. Bitte erneut versuchen.'},503);
    return json({url:`/report#${body.reportToken}`,status:'accepted',reference:id,consultationRequested:crmConsent,expiresInDays:30},201);
  }catch(error){return json({error:error instanceof Error?error.message:'Report konnte nicht gespeichert werden.'},400);}
}
async function authorizedReport(request:Request){
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!token||!/^[a-f0-9-]{72}$/.test(token))return null;
  return rawDb().prepare('SELECT id, analysis, created_at, expires_at, crm_status, crm_consent FROM reports WHERE token_hash = ? AND expires_at > ?').bind(await hash(token),Date.now()).first<{id:string;analysis:string;created_at:number;expires_at:number;crm_status:string;crm_consent:number}>();
}
export async function GET(request:Request){
  try{const row=await authorizedReport(request);if(!row)return json({error:'Report nicht gefunden oder nach 30 Tagen abgelaufen.'},404);const analysis=JSON.parse(row.analysis) as Analysis;return json({analysis,html:reportHtml(analysis,new Date(row.created_at).toISOString()),expiresAt:row.expires_at,consultationRequested:!!row.crm_consent});}catch{return json({error:'Report konnte nicht geladen werden.'},503);}
}
export async function DELETE(request:Request){
  try{const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Anfrage abgelehnt.'},403);const row=await authorizedReport(request);if(!row)return json({error:'Report nicht gefunden.'},404);await rawDb().prepare('DELETE FROM reports WHERE id = ?').bind(row.id).run();return json({deleted:true,crmNotice:row.crm_consent?'Eine bereits übermittelte CRM-Anfrage muss zusätzlich beim Verantwortlichen gelöscht werden.':''});}catch{return json({error:'Löschen fehlgeschlagen.'},503);}
}
