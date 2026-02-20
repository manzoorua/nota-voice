import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [react()];

  if (mode === 'development') {
    import('lovable-tagger').then(({ componentTagger }) => {
      plugins.push(componentTagger());
    }).catch(() => {});
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, "index.html"),
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['@tanstack/react-query']
    }
  };
});
