import { defineConfig, globalIgnores } from "eslint/config";
import raycastConfig from "@raycast/eslint-config";

export default defineConfig([globalIgnores(["dist/", "raycast-env.d.ts"]), ...raycastConfig]);
