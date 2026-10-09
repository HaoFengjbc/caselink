import type {NextConfig} from 'next';
const config:NextConfig={
  // PDF.js is imported inside a bounded Node worker, not bundled as a browser worker.
  serverExternalPackages:['pdfjs-dist'],
  outputFileTracingIncludes:{'/api/materials':['./node_modules/pdfjs-dist/**/*','./node_modules/@napi-rs/canvas*/**/*']},
};
export default config;
