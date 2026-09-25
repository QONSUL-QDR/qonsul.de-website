import {json} from '@/lib/server';
declare const __QONSUL_SOURCE_COMMIT_SHA__: string;
declare const __QONSUL_SOURCE_TREE_SHA__: string;
declare const __QONSUL_SOURCE_BUILD_ID__: string;
declare const __QONSUL_SOURCE_DEPLOY_ID__: string;
declare const __QONSUL_DEPLOYMENT_ENVIRONMENT__: string;
export function GET(){return json({application:'qonsul-website',commit:__QONSUL_SOURCE_COMMIT_SHA__,tree:__QONSUL_SOURCE_TREE_SHA__,buildId:__QONSUL_SOURCE_BUILD_ID__,deployId:__QONSUL_SOURCE_DEPLOY_ID__,environment:__QONSUL_DEPLOYMENT_ENVIRONMENT__});}
