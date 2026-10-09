import { test } from 'vitest';
test('curated corpus passes schema, ownership and sensitive historical distinctions', async()=>{
  await import('./check-data');
});
