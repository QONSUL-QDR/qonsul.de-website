import {CONTACT_PRIVACY_VERSION} from '@/lib/contact';
import {syncContactLead,type ContactLead} from '@/lib/crm';
import {sendContactSummary} from '@/lib/mail';
import {hash,json,purgeExpired,rateLimit,rawDb,readBody,setting} from '@/lib/server';

const value=(body:Record<string,unknown>,key:string,max:number,required=true)=>{
  const input=body[key];
  if(input==null&&!required)return '';
  if(typeof input!=='string'||(required&&!input.trim())||input.length>max)throw new Error(`Bitte ${key==='name'?'Ihren Namen':key==='message'?'eine kurze Nachricht':key==='email'?'eine gültige E-Mail-Adresse':'gültige Angaben'} eingeben.`);
  return input.trim();
};

export async function POST(request:Request){
  try{
    const body=await readBody(request);
    if(body.website)throw new Error('Anfrage abgelehnt.');
    if(body.privacyAcknowledged!==true||body.privacyVersion!==CONTACT_PRIVACY_VERSION)throw new Error('Bitte bestätigen Sie, dass Sie die Datenschutzhinweise gelesen haben.');
    if(setting('PRODUCTION_READY')!=='true'&&body.demoConfirmed!==true)throw new Error('In der privaten Vorschau bitte nur fiktive Testdaten verwenden und dies bestätigen.');
    const name=value(body,'name',100),email=value(body,'email',254).toLowerCase(),phone=value(body,'phone',50,false),company=value(body,'company',150,false),message=value(body,'message',2000);
    if(name.length<2)throw new Error('Bitte Ihren Namen angeben.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Bitte eine gültige E-Mail-Adresse angeben.');
    if(message.length<10)throw new Error('Bitte beschreiben Sie Ihr Anliegen in mindestens 10 Zeichen.');
    if(typeof body.clientToken!=='string'||!/^[a-f0-9-]{36}$/.test(body.clientToken))throw new Error('Ungültiger Anfrage-Schlüssel.');
    const db=rawDb(),clientTokenHash=await hash(body.clientToken);await purgeExpired();
    const previous=await db.prepare('SELECT id, name, email, phone, company, message, privacy_version, created_at, crm_status, email_status FROM contact_requests WHERE client_token_hash = ?').bind(clientTokenHash).first<{id:string;name:string;email:string;phone:string|null;company:string|null;message:string;privacy_version:string;created_at:number;crm_status:string;email_status:string}>();
    if(previous){const finalCrm=previous.crm_status==='pending'?await syncContactLead({id:previous.id,name:previous.name,email:previous.email,phone:previous.phone||'',company:previous.company||'',message:previous.message,privacyVersion:previous.privacy_version,submittedAt:previous.created_at}):previous.crm_status;if(setting('PRODUCTION_READY')==='true'&&finalCrm!=='sent')return json({error:'Ihre Anfrage ist sicher vorgemerkt, konnte aber noch nicht vollständig übermittelt werden. Bitte versuchen Sie es erneut.'},503);return json({status:'accepted',reference:previous.id});}
    if(!await rateLimit(request,'contact',6))return json({error:'Zu viele Kontaktanfragen. Bitte versuchen Sie es später erneut.'},429);
    const id=crypto.randomUUID(),now=Date.now();
    const requestedCrm=setting('PRODUCTION_READY')==='true';
    const requestedMail=setting('PRODUCTION_READY')==='true'&&!!setting('RESEND_API_KEY')&&!!setting('CONTACT_FROM_EMAIL')&&!!setting('PUBLIC_CONTACT_EMAIL');
    const crmStatus=requestedCrm?'pending':'not_configured',emailStatus=requestedMail?'pending':'not_configured';
    const retention=Math.min(730,Math.max(30,Number(setting('CONTACT_RETENTION_DAYS'))||90));
    await db.prepare('INSERT INTO contact_requests (id, client_token_hash, name, email, phone, company, message, privacy_version, created_at, expires_at, crm_status, email_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id,clientTokenHash,name,email,phone||null,company||null,message,CONTACT_PRIVACY_VERSION,now,now+retention*86400000,crmStatus,emailStatus).run();
    const lead:ContactLead={id,name,email,phone,company,message,privacyVersion:CONTACT_PRIVACY_VERSION,submittedAt:now};
    const [finalCrm]=await Promise.all([
      crmStatus==='pending'?syncContactLead(lead):Promise.resolve(crmStatus),
      emailStatus==='pending'?sendContactSummary(lead):Promise.resolve(emailStatus),
    ]);
    if(setting('PRODUCTION_READY')==='true'&&finalCrm!=='sent')return json({error:'Ihre Anfrage ist sicher vorgemerkt, konnte aber noch nicht vollständig übermittelt werden. Bitte versuchen Sie es erneut.'},503);
    return json({status:'accepted',reference:id},201);
  }catch(error){return json({error:error instanceof Error?error.message:'Kontaktanfrage konnte nicht gespeichert werden.'},400);}
}

export async function DELETE(request:Request){
  try{
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return json({error:'Anfrage abgelehnt.'},403);
    const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
    if(!token||!/^[a-f0-9-]{36}$/.test(token))return json({error:'Kontaktanfrage nicht gefunden.'},404);
    const db=rawDb(),row=await db.prepare('SELECT id, crm_status, email_status FROM contact_requests WHERE client_token_hash = ?').bind(await hash(token)).first<{id:string;crm_status:string;email_status:string}>();
    if(!row)return json({error:'Kontaktanfrage nicht gefunden.'},404);
    await db.prepare('DELETE FROM contact_requests WHERE id = ?').bind(row.id).run();
    return json({deleted:true,externalNotice:row.crm_status==='sent'||row.email_status==='sent'?'Bereits an externe Empfänger übermittelte Daten werden dadurch nicht automatisch gelöscht.':''});
  }catch{return json({error:'Löschen fehlgeschlagen.'},503);}
}
