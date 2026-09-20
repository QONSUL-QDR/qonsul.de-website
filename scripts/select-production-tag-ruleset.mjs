import { readFile } from 'node:fs/promises';
import { selectReleaseTagRuleset } from '../lib/production-artifact.mjs';

const [file] = process.argv.slice(2);
if (!file) throw new Error('Usage: select-production-tag-ruleset.mjs <rulesets.json>');

const rulesets = JSON.parse(await readFile(file, 'utf8'));
process.stdout.write(String(selectReleaseTagRuleset(rulesets)));
