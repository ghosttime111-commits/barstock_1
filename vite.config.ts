import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      // nitro/vite builds from this.
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      outDir: ".vercel/output/static",
      filename: "sw.ts",
      injectRegister: null,
      registerType: "prompt",
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["offline.html"],
      includeManifestIcons: false,
      manifest: {
        name: "BarStock — переучёт и контроль остатков",
        short_name: "BarStock",
        description: "Переучёты, списания и перемещения ресторанной сети",
        lang: "ru",
        start_url: "/login",
        scope: "/",
        display: "standalone",
        orientation: "any",
        prefer_related_applications: false,
        theme_color: "#17130f",
        background_color: "#17130f",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Переучёты",
            short_name: "Переучёты",
            url: "/inventories",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Списания",
            short_name: "Списания",
            url: "/write-offs",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
          {
            name: "Перемещения",
            short_name: "Перемещения",
            url: "/transfers",
            icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
          },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,png,svg,ico,woff,woff2}"],
        globIgnores: ["**/*.map", "**/*.json", "**/*.xls", "**/*.xlsx"],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
    nitro({ preset: "vercel" }),
  ],
});
