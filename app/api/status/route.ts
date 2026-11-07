import {json,setting} from '@/lib/server';
import {isCockpitIntakeConfigured} from '@/lib/cockpit-intake-config';
declare const __QONSUL_SOURCE_COMMIT_SHA__: string;
declare const __QONSUL_SOURCE_BUILD_ID__: string;
export function GET(){const productionReady=setting('PRODUCTION_READY')==='true';const intakeReady=isCockpitIntakeConfigured({baseUrl:setting('QONSUL_COCKPIT_INTAKE_URL'),secret:setting('QONSUL_COCKPIT_INTAKE_SECRET')});const mail=!!setting('RESEND_API_KEY')&&!!setting('CONTACT_FROM_EMAIL')&&!!setting('PUBLIC_CONTACT_EMAIL');const candidateIdentity=__QONSUL_SOURCE_COMMIT_SHA__&&__QONSUL_SOURCE_BUILD_ID__?{commit:__QONSUL_SOURCE_COMMIT_SHA__,buildId:__QONSUL_SOURCE_BUILD_ID__}:null;return json({ai:intakeReady,diagnosticReady:intakeReady,crm:intakeReady,cockpit:intakeReady,mail,productionReady,contactReady:productionReady&&intakeReady&&mail,contactEmail:setting('PUBLIC_CONTACT_EMAIL'),candidateIdentity});}
