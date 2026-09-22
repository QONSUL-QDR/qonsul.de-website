import { readFile } from 'node:fs/promises';
import { assertEnvironmentProtection } from '../lib/production-deployment.mjs';

const [environmentPath, policiesPath] = process.argv.slice(2);
if (!environmentPath || !policiesPath) throw new Error('Usage: verify-production-deployment-environment.mjs <environment.json> <branch-policies.json>');
const environment = JSON.parse(await readFile(environmentPath, 'utf8'));
const policies = JSON.parse(await readFile(policiesPath, 'utf8'));
assertEnvironmentProtection(environment, policies.branch_policies);
