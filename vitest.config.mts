import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Live tests run only through `npm run test:live`, which loads the server credentials from `.env.local`.
    exclude: process.env.CALIBRE_URL ? configDefaults.exclude : [...configDefaults.exclude, "**/*.live.test.ts"],
  },
});
