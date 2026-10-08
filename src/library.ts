import { getPreferenceValues } from "@raycast/api";
import { homedir } from "node:os";
import { join } from "node:path";
import { createFileCache } from "./file-cache";
import { createServer } from "./server";

const DEFAULT_CACHE_LIMIT_GB = 2;

export function loadLibrary() {
  const { serverUrl, username, password, cacheLimitGb } = getPreferenceValues<Preferences>();
  const server = createServer({ url: serverUrl, username, password });
  const limitGb = Number(cacheLimitGb);
  const files = createFileCache({
    dir: join(homedir(), "Library", "Caches", "raycast-calibre-web"),
    limitBytes: (limitGb > 0 ? limitGb : DEFAULT_CACHE_LIMIT_GB) * 1024 ** 3,
    download: server.download,
  });
  return { server, files };
}
