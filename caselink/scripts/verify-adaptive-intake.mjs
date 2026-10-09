import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

if (!process.argv.includes('--allow-paid-ai')) throw new Error('Pass --allow-paid-ai to authorize exactly two fictional intake requests.');
const base = new URL(process.argv.find(arg => arg.startsWith('--base='))?.slice(7) || 'http://127.0.0.1:3015');
const scenarios = [
  { id: 'fictional-civil-letter', kind: 'civil', narrative: 'This is a fictional test. A London editor received a solicitor letter asking the newspaper to remove an article. No court claim has been served and nobody is detained. The editor already has a solicitor. They have not yet replied to the letter.', goal: 'Prepare a clear record of the letter and questions for our solicitor.', resources: ['lawyer'] },
  { id: 'fictional-criminal-custody', kind: 'criminal', narrative: 'This is a fictional test. A reporter was arrested in London yesterday while covering a protest and is still held at a police station. The family cannot contact the reporter. They have no lawyer and have received no written notice. No hearing has taken place.', goal: 'Find appropriate help and clarify the current restrictions.', resources: ['none'] },
];
const report = { checkedAt: new Date().toISOString(), base: base.origin, paidRequests: 0, results: [] };
for (const scenario of scenarios) {
  const input = { schemaVersion: '1.0', country: 'United Kingdom', stage: 'unknown', currentProblems: ['unknown'], background: { activities: [], personType: 'unknown', description: '' }, primaryGoal: 'other', keyDates: [], resources: scenario.resources, resourceConstraints: '', priorActions: { status: 'unknown', description: '', date: '' }, publicity: 'private', isExample: true, exampleId: scenario.id,
    intake: { version: 1, jurisdiction: 'England and Wales', caseKind: scenario.kind, narrative: scenario.narrative, goalText: scenario.goal, disclosureDetails: 'Keep names private. Do not contact anyone.', answers: [], facts: [], confirmed: false } };
  const start = Date.now(); report.paidRequests++;
  const response = await fetch(new URL('/api/intake', base), { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base.origin }, body: JSON.stringify({ input, locale: 'en' }), signal: AbortSignal.timeout(40000) });
  const body = await response.json();
  const row = { id: scenario.id, httpStatus: response.status, latencyMs: Date.now() - start, mode: body.mode, model: body.model, facts: body.facts?.length, questions: body.questions?.map(q => q.id), code: body.code };
  report.results.push(row);
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/adaptive-intake-live.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(row));
  assert.equal(response.status, 200); assert.equal(body.mode, 'live_ai'); assert.equal(body.model, 'gpt-6-luna');
  assert(body.facts.length > 0); assert(body.questions.length <= 3);
  assert(body.facts.every(f => f.text === f.quote && scenario.narrative.includes(f.quote)));
  assert(!body.questions.some(q => q.id === 'uk-jurisdiction' || q.id === 'case-kind'));
}
assert.notDeepEqual([...report.results[0].questions].sort(), [...report.results[1].questions].sort(), 'Different case facts should produce different question selection.');
report.status = 'passed';
await writeFile('test-results/adaptive-intake-live.json', JSON.stringify(report, null, 2));
