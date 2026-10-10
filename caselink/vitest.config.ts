import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
// Unit tests never use the ambient account for web search; transport tests opt in with mocked fetch.
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},test:{env:{OPENAI_WEB_SEARCH_ENABLED:'false'},include:['tests/**/*.test.ts','scripts/**/*.test.ts'],exclude:['tests/e2e/**']}});
