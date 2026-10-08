import { Application, getApplications, getDefaultApplication } from "@raycast/api";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Launch Services picks apps by extension, so an empty probe file stands in for a book not yet downloaded.
async function probeFile(format: string): Promise<string> {
  const dir = join(tmpdir(), "raycast-calibre-web-probes");
  await mkdir(dir, { recursive: true });
  const probe = join(dir, `probe.${format}`);
  await writeFile(probe, "");
  return probe;
}

export async function defaultApps(formats: string[]): Promise<Record<string, Application>> {
  const entries = await Promise.all(
    formats.map(async (format) => {
      const app = await getDefaultApplication(await probeFile(format)).catch(() => undefined);
      return app ? [[format, app] as const] : [];
    }),
  );
  return Object.fromEntries(entries.flat());
}

export async function appsFor(format: string): Promise<Application[]> {
  return getApplications(await probeFile(format));
}
