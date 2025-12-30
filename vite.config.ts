import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Read .env.local directly to ensure it takes precedence over system env vars
    let apiKey = '';
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const envContent = fs.readFileSync(envLocalPath, 'utf-8');
      const match = envContent.match(/GEMINI_API_KEY=(.+)/);
      if (match) {
        apiKey = match[1].trim();
      }
    }

    // Fallback to loadEnv if .env.local doesn't have the key
    if (!apiKey) {
      const env = loadEnv(mode, process.cwd(), '');
      apiKey = env.GEMINI_API_KEY || '';
    }

    console.log('[Vite Config] Loading GEMINI_API_KEY:', apiKey ? `...${apiKey.slice(-8)}` : 'NOT SET');

    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
