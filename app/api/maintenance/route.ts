import {json,purgeExpired,rawDb,setting,timingSafeEqual} from '@/lib/server';
export async function POST(request:Request){
  const secret=setting('MAINTENANCE_SECRET');
  const provided=request.headers.get('authorization')||'';
  if(!secret||!(await timingSafeEqual(provided,`Bearer ${secret}`)))return json({error:'Nicht autorisiert.'},401);
  await purgeExpired();await rawDb().prepare('DELETE FROM rate_limits WHERE expires_at < ?').bind(Date.now()).run();
  return json({purged:true});
}
