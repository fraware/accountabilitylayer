import { defineConfig } from 'cypress';

export default defineConfig({
  video: false,
  e2e: {
    setupNodeEvents() {},
    baseUrl: 'http://localhost:3000',
  },
});
