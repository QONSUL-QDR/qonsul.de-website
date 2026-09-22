import { readFile } from 'node:fs/promises';
import { selectGitHubArtifact } from '../lib/production-deployment.mjs';

const [file, artifactName, digest] = process.argv.slice(2);
if (!file || !artifactName || !digest) throw new Error('Usage: select-sealed-github-artifact.mjs <artifacts.json> <name> <digest>');
const payload = JSON.parse(await readFile(file, 'utf8'));
const artifact = selectGitHubArtifact(payload.artifacts, { artifactName, digest });
process.stdout.write(`${JSON.stringify({ id: artifact.id, archive_download_url: artifact.archive_download_url })}\n`);
