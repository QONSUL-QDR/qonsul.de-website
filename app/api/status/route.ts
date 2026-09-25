import {json,setting} from '@/lib/server';
declare const __QONSUL_SOURCE_COMMIT_SHA__: string;
declare const __QONSUL_SOURCE_TREE_SHA__: string;
declare const __QONSUL_SOURCE_BUILD_ID__: string;
declare const __QONSUL_SOURCE_DEPLOY_ID__: string;
declare const __QONSUL_DEPLOYMENT_ENVIRONMENT__: string;
export function GET(){const identity={application:'qonsul-website',commit:__QONSUL_SOURCE_COMMIT_SHA__,tree:__QONSUL_SOURCE_TREE_SHA__,buildId:__QONSUL_SOURCE_BUILD_ID__,deployId:__QONSUL_SOURCE_DEPLOY_ID__,environment:__QONSUL_DEPLOYMENT_ENVIRONMENT__};if(__QONSUL_DEPLOYMENT_ENVIRONMENT__==='staging')return json(identity);const productionReady=setting('PRODUCTION_READY')==='true';const crm=!!setting('HUBSPOT_ACCESS_TOKEN');const mail=!!setting('RESEND_API_KEY')&&!!setting('CONTACT_FROM_EMAIL')&&!!setting('PUBLIC_CONTACT_EMAIL');return json({...identity,ai:!!setting('OPENAI_API_KEY'),crm,mail,productionReady,contactReady:productionReady&&crm&&mail,contactEmail:setting('PUBLIC_CONTACT_EMAIL')});}
