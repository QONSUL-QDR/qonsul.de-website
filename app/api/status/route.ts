import {cockpitConfigured} from '@/lib/crm';
import {json,setting} from '@/lib/server';
import {BUILD_COMMIT_SHA} from '@/lib/build-info';
export function GET(){const productionReady=setting('PRODUCTION_READY')==='true';const crm=cockpitConfigured();const mail=!!setting('RESEND_API_KEY')&&!!setting('CONTACT_FROM_EMAIL')&&!!setting('PUBLIC_CONTACT_EMAIL');return json({ai:!!setting('OPENAI_API_KEY'),crm,mail,productionReady,contactReady:productionReady&&crm,contactEmail:setting('PUBLIC_CONTACT_EMAIL'),commit:BUILD_COMMIT_SHA});}
