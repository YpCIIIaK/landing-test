import { defineConfig } from "vite"

export default defineConfig({
  root: ".",
  server: {
    port: 5173,
    proxy: {
      // Все запросы к /api проксируем на Node.js бэк, чтобы избежать CORS в dev
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2020",
  },
})
