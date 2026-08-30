import {json,purgeExpired,rawDb,setting} from '@/lib/server';
export async function POST(request:Request){
  const secret=setting('MAINTENANCE_SECRET');if(!secret||request.headers.get('authorization')!==`Bearer ${secret}`)return json({error:'Nicht autorisiert.'},401);
  await purgeExpired();await rawDb().prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()).run();
  return json({purged:true});
}
