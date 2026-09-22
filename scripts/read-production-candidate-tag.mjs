import { execFileSync } from 'node:child_process';
import { parseAnnotatedTag } from '../lib/production-artifact.mjs';

const [candidateDirectory, tag] = process.argv.slice(2);
if (!candidateDirectory || !tag) throw new Error('Usage: read-production-candidate-tag.mjs <git-directory> <tag>');
const parsed = parseAnnotatedTag(execFileSync('git', ['-C', candidateDirectory, 'cat-file', '-p', `refs/tags/${tag}`], { encoding: 'utf8' }));
if (parsed.tag !== tag) throw new Error('Fetched annotated tag name does not match the requested tag.');
const matches = [...parsed.message.matchAll(/^CI-Run: (\d+)$/gm)];
if (matches.length !== 1) throw new Error('Annotated tag must contain exactly one Candidate CI run ID.');
const tagObject = execFileSync('git', ['-C', candidateDirectory, 'rev-parse', `${tag}^{tag}`], { encoding: 'utf8' }).trim();
process.stdout.write(`${JSON.stringify({ tagObject, ciRunId: matches[0][1] })}\n`);
