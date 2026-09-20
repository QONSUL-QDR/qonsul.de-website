import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  assertReleaseInputs,
  assertReleaseTagRuleset,
  assertSuccessfulCiRun,
  assertTagMessage,
  parseAnnotatedTag,
} from '../lib/production-artifact.mjs';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

const tag = readArgument('--tag');
const expectedCommit = readArgument('--expected-commit');
const expectedTree = readArgument('--expected-tree');
const ciRunId = readArgument('--ci-run-id');
const ciJson = readArgument('--ci-json');
const rulesetJson = readArgument('--ruleset-json');
const ref = `refs/tags/${tag}`;

assertReleaseInputs({ tag, commit: expectedCommit, tree: expectedTree, ciRunId });

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('cat-file', '-t', ref) !== 'tag') throw new Error('Release ref is not an annotated tag.');

const parsedTag = parseAnnotatedTag(git('cat-file', '-p', ref));
const peeledCommit = git('rev-parse', `${ref}^{}`);
const tree = git('rev-parse', `${peeledCommit}^{tree}`);

if (parsedTag.tag !== tag || parsedTag.object !== expectedCommit || peeledCommit !== expectedCommit || tree !== expectedTree) {
  throw new Error('Annotated tag, peeled commit, or tree differs from release inputs.');
}

assertTagMessage(parsedTag.message, { commit: expectedCommit, tree: expectedTree, ciRunId });
assertSuccessfulCiRun(JSON.parse(await readFile(ciJson, 'utf8')), expectedCommit);
assertReleaseTagRuleset(JSON.parse(await readFile(rulesetJson, 'utf8')));

process.stdout.write(`${JSON.stringify({
  tag,
  tagObject: git('rev-parse', ref),
  commit: expectedCommit,
  tree: expectedTree,
  ciRunId: String(ciRunId),
})}\n`);
