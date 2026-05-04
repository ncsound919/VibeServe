import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// Heavy Node-only packages that must never be bundled for the browser
const NODE_EXTERNALS = [
  'child_process',
  'url',
  'path',
  'fs',
  'os',
  'crypto',
  'net',
  'tls',
  'http',
  'https',
  'stream',
  'zlib',
  'events',
  'util',
  'process',
  'dns',
  'http2',
  'worker_threads',
  '@temporalio/worker',
  '@temporalio/workflow',
  '@temporalio/activity',
  '@temporalio/client',
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({
      // Only polyfill modules that are actually imported in browser code.
      // Heavy modules (fs, net, tls) are kept external so they never hit the browser bundle.
      include: ['path', 'process', 'os', 'crypto', 'stream', 'util', 'events', 'buffer', 'url', 'zlib'],
    }),
  ],
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": { target: "http://localhost:3002", changeOrigin: true },
      "/ws": { target: "ws://localhost:3002", ws: true },
    },
  },
  build: {
    target: "esnext",
    // Enable sourcemaps in CI/dev builds; disable for production release
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      external: NODE_EXTERNALS,
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts", "lightweight-charts"],
          motion: ["motion"],
          zustand: ["zustand"],
          gemini: ["@google/genai"],
          icons: ["lucide-react"],
          query: ["@tanstack/react-query"],
          langchain: ["langchain", "@langchain/core", "@langchain/community"],
          supabase: ["@supabase/supabase-js", "@supabase/postgrest-js"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          editor: ["@monaco-editor/react"],
        },
      },
    },
  },
  preview: {
    port: 3000,
    headers: {
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        "connect-src 'self' https://generativelanguage.googleapis.com https://api.github.com https://openrouter.ai https://api.deepseek.com https://*.supabase.co wss: ws:",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "1.0.0"),
  },
});
