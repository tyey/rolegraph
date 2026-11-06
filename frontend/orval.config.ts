import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: { target: './openapi.json' },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints',
      schemas: 'src/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      baseUrl: 'http://localhost:8000',
      clean: true,
    },
  },
  apiZod: {
    input: { target: './openapi.json' },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/zod',
      client: 'zod',
      fileExtension: '.zod.ts',
      clean: true,
    },
  },
})
