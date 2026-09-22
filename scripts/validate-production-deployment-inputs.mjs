import { assertDeploymentInputs } from '../lib/production-deployment.mjs';

const [artifactName, tag, commit, tree, digest] = process.argv.slice(2);
assertDeploymentInputs({ artifactName, tag, commit, tree, digest });
