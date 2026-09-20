import { assertReleaseInputs } from '../lib/production-artifact.mjs';

const [tag, commit, tree, ciRunId] = process.argv.slice(2);
assertReleaseInputs({ tag, commit, tree, ciRunId });
process.stdout.write('Production artifact inputs have the expected safe shape.\n');
