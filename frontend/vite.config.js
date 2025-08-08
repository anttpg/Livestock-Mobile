import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

console.log('TUNNEL_HOST:', process.env.TUNNEL_HOST);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    host: true,//process.env.VITE_HOST, 
    https: process.env.HOST_KEY && process.env.HOST_PEM ? {
      key: fs.readFileSync(process.env.HOST_KEY),
      cert: fs.readFileSync(process.env.HOST_PEM),
    } : false,
    allowedHosts: process.env.TUNNEL_HOST ? [process.env.TUNNEL_HOST] : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
});