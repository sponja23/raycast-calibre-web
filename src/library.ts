import { getPreferenceValues } from "@raycast/api";
import { homedir } from "node:os";
import { join } from "node:path";
import { createCalibreWebClient } from "./calibre-web";
import { createFileCache } from "./file-cache";

const DEFAULT_CACHE_LIMIT_GB = 2;

export function loadLibrary() {
  const preferences = getPreferenceValues<Preferences>();
  const client = createCalibreWebClient({
    url: preferences.serverUrl,
    username: preferences.username,
    password: preferences.password,
  });
  const limitGb = Number(preferences.cacheLimitGb);
  const cache = createFileCache({
    dir: join(homedir(), "Library", "Caches", "raycast-calibre-web"),
    limitBytes: (limitGb > 0 ? limitGb : DEFAULT_CACHE_LIMIT_GB) * 1024 ** 3,
    download: client.download,
  });
  return { client, cache, preferences };
}

export function fetchCatalog(serverUrl: string, username: string) {
  const { password } = getPreferenceValues<Preferences>();
  return createCalibreWebClient({ url: serverUrl, username, password }).fetchCatalog();
}
