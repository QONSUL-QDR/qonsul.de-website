export type IntakeSource='contact'|'ishikawa';
export type IntakeEvent={source_event_id:string;submitted_at:string;payload_schema_version:'1.0';[key:string]:unknown};
export type IntakeDelivery={status:'accepted';reference:string};

export class IntakeDeliveryError extends Error{
  readonly transient:boolean;
  constructor(message:string,transient:boolean){super(message);this.name='IntakeDeliveryError';this.transient=transient;}
}

const bytes=(value:string)=>new TextEncoder().encode(value);
const hex=(buffer:ArrayBuffer)=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,'0')).join('');
async function sha256(value:string){return hex(await crypto.subtle.digest('SHA-256',bytes(value)));}
export async function signature(secret:string,method:string,path:string,timestamp:number,sourceEventId:string,body:string){
  const key=await crypto.subtle.importKey('raw',bytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const canonical=[method.toUpperCase(),path,String(timestamp),sourceEventId.toLowerCase(),await sha256(body)].join('\n');
  return hex(await crypto.subtle.sign('HMAC',key,bytes(canonical)));
}

export async function deliverIntake(source:IntakeSource,event:IntakeEvent,options:{baseUrl:string;secret:string;fetchImpl?:typeof fetch;attempts?:number;timeoutMs?:number}):Promise<IntakeDelivery>{
  if(options.secret.length<32)throw new IntakeDeliveryError('Intake authentication is not configured.',false);
  const base=new URL(options.baseUrl);if(base.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(base.hostname))throw new IntakeDeliveryError('Intake URL must use HTTPS.',false);
  const path=`/api/v1/intake/${source}`,url=new URL(path,base),body=JSON.stringify(event),requestId=crypto.randomUUID();
  const execute=options.fetchImpl||fetch,attempts=Math.min(3,Math.max(1,options.attempts||3)),timeoutMs=Math.min(10000,Math.max(500,options.timeoutMs||4000));
  for(let attempt=0;attempt<attempts;attempt++){
    const timestamp=Math.floor(Date.now()/1000);
    try{
      const response=await execute(url,{method:'POST',signal:AbortSignal.timeout(timeoutMs),headers:{'Content-Type':'application/json','Accept':'application/json','X-Qonsul-Timestamp':String(timestamp),'X-Qonsul-Signature':`v1=${await signature(options.secret,'POST',path,timestamp,event.source_event_id,body)}`,'X-Request-ID':requestId},body});
      if(response.ok){const result=await response.json() as Partial<IntakeDelivery>;if(result.status==='accepted'&&typeof result.reference==='string')return result as IntakeDelivery;throw new IntakeDeliveryError('Unexpected intake response.',false);}
      if(response.status<500&&response.status!==429)throw new IntakeDeliveryError('Intake request was rejected.',false);
      if(attempt===attempts-1)throw new IntakeDeliveryError('Intake service is temporarily unavailable.',true);
    }catch(error){
      if(error instanceof IntakeDeliveryError&&!error.transient)throw error;
      if(attempt===attempts-1)throw error instanceof IntakeDeliveryError?error:new IntakeDeliveryError('Intake service is temporarily unavailable.',true);
    }
    await new Promise(resolve=>setTimeout(resolve,150*(attempt+1)));
  }
  throw new IntakeDeliveryError('Intake service is temporarily unavailable.',true);
}
