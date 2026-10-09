import {describe,it,expect} from 'vitest';
import {cases,resources} from '../src/lib/corpus';
import {EN_CONTENT,localizeCase,localizeResource} from '../src/lib/i18n/content';

describe('Content refresh and review metadata',()=>{
  it('does not reuse a stale translated case by ID when the current record changes',()=>{
    const original=cases[0];
    const first=localizeCase(original,'en');
    const updated={...original,updatedAt:'2099-01-01',country:'Changed jurisdiction for this test'};
    const second=localizeCase(updated,'en');
    expect(second.country).toBe(updated.country);
    expect(second).not.toBe(first);
    expect(first.country).toBe(original.country);
  });
  it('translates applicability metadata without upgrading review status',()=>{
    const original=resources[0],previous=EN_CONTENT.resources[original.resourceId];
    EN_CONTENT.resources[original.resourceId]={...previous,summary:'Summary',eligibility:['Eligibility condition'],unknowns:['Requires review']};
    try{
      const shown=localizeResource({...original,reviewStatus:'unreviewed'},'en');
      expect(shown.summary).toBe('Summary');
      expect(shown.eligibility).toEqual(['Eligibility condition']);
      expect(shown.unknowns).toEqual(['Requires review']);
      expect(shown.reviewStatus).toBe('unreviewed');
    }finally{EN_CONTENT.resources[original.resourceId]=previous;}
  });
});
