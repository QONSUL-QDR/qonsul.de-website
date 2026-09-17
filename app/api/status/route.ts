import {json} from '@/lib/server';
import {BUILD_APPLICATION,BUILD_COMMIT_SHA,BUILD_TREE_SHA} from '@/lib/build-info';
export function GET(){return json({application:BUILD_APPLICATION,git_commit:BUILD_COMMIT_SHA,git_tree:BUILD_TREE_SHA,deploy_id:BUILD_COMMIT_SHA,commit:BUILD_COMMIT_SHA});}
