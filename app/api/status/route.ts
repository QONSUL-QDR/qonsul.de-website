import {cockpitConfigured} from '@/lib/crm';
import {json,setting} from '@/lib/server';
import {BUILD_APPLICATION,BUILD_COMMIT_SHA,BUILD_TREE_SHA} from '@/lib/build-info';
declare const __QONSUL_SOURCE_COMMIT_SHA__: string;
declare const __QONSUL_SOURCE_BUILD_ID__: string;
export function GET(){const productionReady=setting('PRODUCTION_READY')==='true';const crm=cockpitConfigured();const mail=!!setting('RESEND_API_KEY')&&!!setting('CONTACT_FROM_EMAIL')&&!!setting('PUBLIC_CONTACT_EMAIL');const candidateIdentity=__QONSUL_SOURCE_COMMIT_SHA__&&__QONSUL_SOURCE_BUILD_ID__?{commit:__QONSUL_SOURCE_COMMIT_SHA__,buildId:__QONSUL_SOURCE_BUILD_ID__}:null;return json({application:BUILD_APPLICATION,environment:productionReady?'production':'staging',git_commit:BUILD_COMMIT_SHA,git_tree:BUILD_TREE_SHA,deploy_id:BUILD_COMMIT_SHA,commit:BUILD_COMMIT_SHA,ai:!!setting('OPENAI_API_KEY'),crm,mail,productionReady,contactReady:productionReady&&crm&&mail,contactEmail:setting('PUBLIC_CONTACT_EMAIL'),candidateIdentity});}
