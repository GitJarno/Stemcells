import { defineConfig } from "vite-plus";
import "vite-plus/test/config";
import { substituteUpstreamModules } from "./src/stemcells/upstream/substitutes/substitutes.cjs";

const reactTests = [
  "src/components/ui/Dialog.android.test.tsx",
  "src/features/settings/SettingsServerControlsRouteScreen.test.tsx",
  "src/features/settings/components/BranchNamingSettings.test.tsx",
  "src/native/NativeHeaderToolbar.test.tsx",
  "src/state/use-selected-thread-git-actions.test.tsx",
];

export default defineConfig({
  plugins: [substituteUpstreamModules()],
  test: {
    // Stemcells' substitutes resolve a module by who imports it, which Vitest's
    // on-disk transform cache doesn't key on: a warm run mixes them up.
    fsModuleCache: false,
    hookTimeout: 60_000,
    testTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["**/*.test.{ts,tsx,mjs}"],
          exclude: ["**/node_modules/**", ...reactTests],
          setupFiles: [
            "../../packages/shared/src/testing/longTempDir.ts",
            "../../packages/shared/src/testing/providerEnv.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "react",
          include: reactTests,
          // Native components mock React Native and render through react-dom in these tests.
          environment: "jsdom",
          setupFiles: ["../../packages/shared/src/testing/providerEnv.ts"],
        },
      },
    ],
  },
});
