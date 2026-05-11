// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    // Make the dev server reachable on your local network (optional but useful).
    host: true,

    // Vite 5+ rejects requests whose Host header doesn't match a known origin.
    // Since VITE_ORIGIN overrides window.location.hostname to "rooialty.vercel.app",
    // the browser never actually sends that hostname to Vite — but if you ever
    // use a proxy or curl test, add it here.
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],

    port: 5173,
  },
})