import {createHash} from 'node:crypto';
import {type NewCaseInput} from '../contracts';
function canonical(value:unknown):string {
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export const hashInput=(input:NewCaseInput)=>createHash('sha256').update(canonical(input)).digest('hex');
