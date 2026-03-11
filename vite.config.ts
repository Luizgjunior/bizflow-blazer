import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import vitePluginBundleObfuscator from "vite-plugin-bundle-obfuscator";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    mode === "production" &&
      vitePluginBundleObfuscator({
        enable: true,
        log: false,
        autoExcludeNodeModules: true,
        threadPool: { enable: true, size: 4 },
        options: {
          // Ofuscação do código
          compact: true,
          simplify: true,
          stringArray: true,
          stringArrayThreshold: 0.75,
          stringArrayEncoding: ["rc4"],
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayWrappersCount: 2,
          stringArrayWrappersType: "function",

          // Control flow
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,

          // Renaming
          renameGlobals: false,
          renameProperties: false,
          identifierNamesGenerator: "hexadecimal",

          // Anti-tampering & anti-debug
          selfDefending: true,
          debugProtection: true,
          debugProtectionInterval: 2000,
          disableConsoleOutput: true,

          // Transforms
          transformObjectKeys: true,
          unicodeEscapeSequence: false,
          splitStrings: true,
          splitStringsChunkLength: 5,
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Remove console.log em produção
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
}));
