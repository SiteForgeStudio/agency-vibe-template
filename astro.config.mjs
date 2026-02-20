import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    react(), 
    tailwind()
  ],
  // 100/100 Lighthouse Performance Settings
  prefetch: true,
  image: {
    domains: ["images.unsplash.com"], // Allow remote optimization if needed
  },
  vite: {
    server: {
      fs: {
        // Allow Vite to access the clients folder outside of /src
        allow: ['..']
      }
    },
    build: {
      // Prevents small images from being inlined as Base64 strings, 
      // which can bloat your HTML and hurt Lighthouse scores.
      assetsInlineLimit: 0
    }
  }
});