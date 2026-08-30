import { env } from 'cloudflare:workers';
export function setting(key: string): string { return String((env as unknown as Record<string,unknown>)[key] || process.env[key] || ''); }
export function rawDb(): D1Database { if(!env.DB) throw new Error('Datenspeicher ist nicht erreichbar.');return env.DB; }
export function json(data: unknown, status=200) { return Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}}); }
export async function readBody(request: Request) {
  const origin = request.headers.get('origin');
  if(origin && origin!==new URL(request.url).origin) throw new Error('Anfrage von einer fremden Website abgelehnt.');
  if(request.headers.get('sec-fetch-site')==='cross-site') throw new Error('Anfrage von einer fremden Website abgelehnt.');
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('JSON erwartet.');
  if(Number(request.headers.get('content-length')||0)>24000) throw new Error('Anfrage zu groß.');
  const reader=request.body?.getReader();if(!reader) throw new Error('Anfrage fehlt.');
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>24000){await reader.cancel();throw new Error('Anfrage zu groß.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes)) as Record<string,unknown>;}catch{throw new Error('Ungültiges JSON.');}
}
export async function hash(value: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(v=>v.toString(16).padStart(2,'0')).join(''); }
export async function rateLimit(request: Request, action: string, limit: number) {
  const db=rawDb();
  const window=Math.floor(Date.now()/3600000);
  // Hour-scoped digest, no raw IP stored. Requests outside the edge share a local bucket.
  const ip=request.headers.get('cf-connecting-ip')||'local';
  const key=await hash(`${setting('RATE_LIMIT_SALT')||'local-preview'}:${window}:${action}:${ip}`);
  await db.prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()).run();
  const row=await db.prepare('INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count').bind(key,(window+1)*3600000).first<{count:number}>();
  return (row?.count||0)<=limit;
}
export async function purgeExpired(){ await rawDb().prepare('DELETE FROM reports WHERE expires_at < ?').bind(Date.now()).run(); }
