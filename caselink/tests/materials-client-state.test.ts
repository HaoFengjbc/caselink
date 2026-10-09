import {describe,expect,it} from 'vitest';
import {currentMaterialResponse,selectionError,setFileStage,type SelectedMaterial} from '../src/components/intake/materials-client-state';

describe('material client admission and response isolation',()=>{
 it('permits one through three PDFs within the actual request budget',()=>{expect(selectionError([{name:'letter.pdf',size:50_000}])).toBeNull();expect(selectionError(Array.from({length:3},(_,i)=>({name:`${i}.pdf`,size:1_000_000})))).toBeNull();});
 it('blocks count, extension, empty, per-file and combined upload limits before fetch',()=>{expect(selectionError(Array.from({length:4},()=>({name:'x.pdf',size:1})))).toBe('count');expect(selectionError([{name:'word.docx',size:1}])).toBe('type');expect(selectionError([{name:'empty.pdf',size:0}])).toBe('size');expect(selectionError([{name:'big.pdf',size:3*1024*1024+1}])).toBe('size');expect(selectionError([{name:'a.pdf',size:2_000_000},{name:'b.pdf',size:2_000_000}])).toBe('total');});
 it('cannot apply late results after cancellation, a new request, or removal',()=>{expect(currentMaterialResponse('old',null,['a'],[{id:'a'}])).toBe(false);expect(currentMaterialResponse('old','new',['a'],[{id:'a'}])).toBe(false);expect(currentMaterialResponse('active','active',['a'],[{id:'b'}])).toBe(false);expect(currentMaterialResponse('active','active',['a'],[{id:'a'},{id:'b'}])).toBe(true);});
 it('server stages touch only the corresponding material',()=>{const files=[{id:'a',state:'selected'},{id:'b',state:'review',processed:true}] as SelectedMaterial[];const next=setFileStage(files,['a'],'reading');expect(next[0].state).toBe('reading');expect(next[1]).toBe(files[1]);expect(files[0].state).toBe('selected');});
});
