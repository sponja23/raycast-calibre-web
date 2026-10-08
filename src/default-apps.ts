import { Application, getDefaultApplication } from "@raycast/api";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Launch Services resolves the default app from the extension, so an empty probe file stands in for books not yet downloaded.
export async function defaultApps(formats: string[]): Promise<Record<string, Application>> {
  const dir = join(tmpdir(), "raycast-calibre-web-probes");
  await mkdir(dir, { recursive: true });
  const entries = await Promise.all(
    formats.map(async (format) => {
      const probe = join(dir, `probe.${format}`);
      await writeFile(probe, "");
      const app = await getDefaultApplication(probe).catch(() => undefined);
      return app ? [[format, app] as const] : [];
    }),
  );
  return Object.fromEntries(entries.flat());
}
