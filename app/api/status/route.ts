import {json,setting} from '@/lib/server';
export function GET(){return json({ai:!!setting('OPENAI_API_KEY'),crm:!!setting('HUBSPOT_ACCESS_TOKEN'),productionReady:setting('PRODUCTION_READY')==='true',contactEmail:setting('PUBLIC_CONTACT_EMAIL')});}
