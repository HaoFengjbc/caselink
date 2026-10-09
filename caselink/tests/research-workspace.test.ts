import {describe,it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {cases,evidence,documents,resources} from '../src/lib/corpus';
import {ComparisonBriefSchema,NewCaseInputSchema,ResourceSchema} from '../src/lib/contracts';
import {buildComparisonBrief,parseComparisonBrief,serializeComparisonBrief,COMPARISON_MAX_BYTES,safeSourceUrl} from '../src/components/research/comparison-data';
import {ComparisonBriefView} from '../src/components/research/ComparisonBriefView';
import {DEMO_SCENARIOS,DEMO_SCENARIOS_EN} from '../data/demo/fixtures';

const selection=['aigul-utepova','emna-chargui'];
describe('public research resources',()=>{
 it('records the real corpus size without promoting legacy excerpt review',()=>{
  expect(cases).toHaveLength(22);expect(new Set(cases.map(c=>c.country)).size).toBe(14);expect(documents).toHaveLength(21);expect(evidence).toHaveLength(187);
  expect(evidence.filter(e=>e.reviewStatus==='conflict')).toHaveLength(5);
 });
 it('has official source metadata with separate agent and human review',()=>{
  expect(resources.length).toBe(16);expect(new Set(resources.map(r=>r.resourceId)).size).toBe(16);
  for(const r of resources){expect(ResourceSchema.safeParse(r).success).toBe(true);expect(r.type).toBeTruthy();expect(r.locator).toBeTruthy();expect(r.summary).toBeTruthy();expect(r.eligibility?.length).toBeGreaterThan(0);expect(r.unknowns?.length).toBeGreaterThan(0);expect(r.teamReviewedAt).toBeNull();expect(r.reviewStatus).not.toBe('team_verified');expect(safeSourceUrl(r.officialUrl)).toBeTruthy();}
  expect(resources.find(r=>r.resourceId==='wgad-submission')?.reviewStatus).toBe('unreviewed');
  expect(resources.find(r=>r.resourceId==='ohchr-special-procedures')?.checkedAt).toBe('2026-10-07');
 });
 it('rejects executable URLs from imported content',()=>{expect(safeSourceUrl('javascript:alert(1)')).toBeNull();expect(safeSourceUrl('https://name:pass@example.com')).toBeNull();});
});
describe('case comparison snapshots',()=>{
 it('requires 2–4 distinct known public cases',()=>{
  expect(()=>buildComparisonBrief([selection[0]])).toThrow();expect(()=>buildComparisonBrief([selection[0],selection[0]])).toThrow();expect(()=>buildComparisonBrief([...selection,'made-up'])).toThrow();expect(()=>buildComparisonBrief(cases.slice(0,5).map(c=>c.caseId))).toThrow();
  expect(ComparisonBriefSchema.safeParse(buildComparisonBrief(cases.slice(0,4).map(c=>c.caseId))).success).toBe(true);
 });
 it('binds every common-theme source to a supporting selected case',()=>{
  const b=buildComparisonBrief(selection);expect(b.commonIssues.length).toBeGreaterThan(0);
  for(const i of b.commonIssues){expect(i.supportingCaseIds.length).toBeGreaterThanOrEqual(2);for(const id of i.evidenceIds)expect(i.supportingCaseIds).toContain(b.snapshot.evidence.find(e=>e.evidenceId===id)!.caseId);expect(i.differences.length).toBeGreaterThan(0);expect(i.unknowns.length).toBeGreaterThan(0);}
  expect(b.limitations.join(' ')).toContain('不能推断国家或全球发生率');
 });
 it('roundtrips a legal backup and rejects inconsistent ownership',()=>{
  const b=buildComparisonBrief(selection);expect(parseComparisonBrief(serializeComparisonBrief(b))).toEqual(b);
  const changed=structuredClone(b);changed.commonIssues[0].evidenceIds=['missing'];expect(()=>parseComparisonBrief(JSON.stringify(changed))).toThrow();
  expect(()=>parseComparisonBrief('x'.repeat(COMPARISON_MAX_BYTES+1))).toThrow(/3 MB/);
  const oversized=structuredClone(b);oversized.title='中'.repeat(COMPARISON_MAX_BYTES/3+1);expect(()=>serializeComparisonBrief(oversized)).toThrow(/3 MB/);
 });
 it('keeps page, quotes, resources and serialized evidence unchanged after current corpus changes',()=>{
  const b=buildComparisonBrief(selection);const before=serializeComparisonBrief(b);const html=renderToStaticMarkup(React.createElement(ComparisonBriefView,{brief:b}));
  const old=[cases[0].summary,evidence[0].exactQuote,documents[0].title,resources[0].applicability];
  try{cases[0].summary='UPDATED TODAY';evidence[0].exactQuote='UPDATED TODAY';documents[0].title='UPDATED TODAY';resources[0].applicability='UPDATED TODAY';expect(serializeComparisonBrief(b)).toBe(before);expect(renderToStaticMarkup(React.createElement(ComparisonBriefView,{brief:b}))).toBe(html);expect(html).not.toContain('UPDATED TODAY');}
  finally{[cases[0].summary,evidence[0].exactQuote,documents[0].title,resources[0].applicability]=old;}
  expect(html).toContain('未记载');expect(html).toContain('查看原文证据');expect(html).toContain('待团队复核');
 });
});
describe('fictional expression demos',()=>{
 it('offers three valid fictional scenarios in each language without a promised UK case',()=>{
  expect(DEMO_SCENARIOS).toHaveLength(3);expect(DEMO_SCENARIOS_EN).toHaveLength(3);
  for(const d of [...DEMO_SCENARIOS,...DEMO_SCENARIOS_EN]){expect(NewCaseInputSchema.safeParse(d.input).success).toBe(true);expect(d.input.isExample).toBe(true);}
  const uk=DEMO_SCENARIOS.find(d=>d.id==='uk-expression-civil')!.input;
  expect(uk.intake?.jurisdiction).toBe('england_wales');expect(uk.intake?.caseKind).toBe('civil');expect(uk.intake?.expression).toBe('yes');expect(uk.publicity).toBe('private');expect(cases.some(c=>c.country==='英国')).toBe(false);
 });
});
