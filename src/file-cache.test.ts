import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BookFile } from "./book";
import { DownloadCancelledError, FileCache, createFileCache } from "./file-cache";

const pdf = (size: number): BookFile => ({ format: "pdf", size, path: `/opds/download/1/pdf/` });

function gatedDownload() {
  const gates = new Map<string, () => void>();
  const download = async (path: string) =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("0123456789"));
          gates.set(path, () => {
            try {
              controller.close();
            } catch {
              // The reader already cancelled the stream.
            }
          });
        },
      }),
    );
  const release = async (path: string) => {
    while (!gates.has(path)) await new Promise((resolve) => setTimeout(resolve, 1));
    gates.get(path)!();
  };
  return { download, release };
}

let dir: string;
let downloads: string[];
let clock: number;

function cache(
  options: { limitBytes?: number; download?: (path: string, signal: AbortSignal) => Promise<Response> } = {},
): FileCache {
  return createFileCache({
    dir,
    limitBytes: options.limitBytes ?? 1_000_000,
    now: () => new Date((clock += 1000)),
    download:
      options.download ??
      (async (path) => {
        downloads.push(path);
        return new Response(`contents of ${path}`);
      }),
  });
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "file-cache-"));
  downloads = [];
  clock = Date.parse("2026-01-01T00:00:00Z");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("open", () => {
  it("downloads a book on first open and reuses the local copy afterwards", async () => {
    const files = cache();

    const first = await files.open(1, pdf(10));
    const second = await files.open(1, pdf(10));

    expect(second).toBe(first);
    expect(await readFile(first, "utf8")).toBe("contents of /opds/download/1/pdf/");
    expect(downloads).toEqual(["/opds/download/1/pdf/"]);
    expect(files.isCached(1, pdf(10))).toBe(true);
  });

  it("reports download progress against the file size", async () => {
    const progress: [number, number][] = [];

    await cache().open(1, pdf(33), (received, total) => progress.push([received, total]));

    expect(progress.at(-1)).toEqual([33, 33]);
  });

  it("leaves nothing cached when a download fails", async () => {
    const files = cache({
      download: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("partial"));
              controller.error(new Error("connection reset"));
            },
          }),
        ),
    });

    await expect(files.open(1, pdf(10))).rejects.toThrow("connection reset");
    expect(files.isCached(1, pdf(10))).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });

  it("replaces the local copy when the server's file changes size", async () => {
    const files = cache();
    const old = await files.open(1, pdf(10));

    const fresh = await files.open(1, pdf(12));

    expect(fresh).not.toBe(old);
    expect(downloads).toHaveLength(2);
    expect(files.isCached(1, pdf(10))).toBe(false);
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("shares one download between concurrent opens of the same file", async () => {
    const files = cache();

    const [a, b] = await Promise.all([files.open(1, pdf(10)), files.open(1, pdf(10))]);

    expect(a).toBe(b);
    expect(downloads).toHaveLength(1);
  });

  it("reports progress to every caller sharing a download", async () => {
    const files = cache();
    const first: number[] = [];
    const second: number[] = [];

    await Promise.all([
      files.open(1, pdf(33), (received) => first.push(received)),
      files.open(1, pdf(33), (received) => second.push(received)),
    ]);

    expect(first.at(-1)).toBe(33);
    expect(second.at(-1)).toBe(33);
  });
});

describe("eviction", () => {
  const book = (id: number): BookFile => ({ format: "pdf", size: 10, path: `/opds/download/${id}/pdf/` });
  const tenBytes = async () => new Response("0123456789");

  it("removes the least recently opened books once the cache passes its limit", async () => {
    const launch = () => cache({ limitBytes: 25, download: tenBytes });

    await launch().open(1, book(1));
    await launch().open(2, book(2));
    await launch().open(1, book(1));
    await launch().open(3, book(3));

    expect([1, 2, 3].filter((id) => launch().isCached(id, book(id)))).toEqual([1, 3]);
  });

  it("never evicts a book opened earlier in the same session", async () => {
    const files = cache({ limitBytes: 15, download: tenBytes });

    const paths = await Promise.all([files.open(1, book(1)), files.open(2, book(2))]);

    expect(paths.every((path) => existsSync(path))).toBe(true);
  });

  it("keeps the book just opened even when it alone exceeds the limit", async () => {
    const launch = () => cache({ limitBytes: 5, download: tenBytes });

    await launch().open(1, book(1));
    await launch().open(2, book(2));

    expect([1, 2].filter((id) => launch().isCached(id, book(id)))).toEqual([2]);
  });

  it("counts and removes partial downloads left behind by an earlier session", async () => {
    await writeFile(join(dir, "7-100.pdf.part"), "x".repeat(100));

    await cache({ limitBytes: 25, download: tenBytes }).open(1, book(1));

    expect(await readdir(dir)).toEqual(["1-10.pdf"]);
  });

  it("neither counts nor removes files it did not download", async () => {
    await writeFile(join(dir, ".DS_Store"), "x".repeat(100));
    const files = cache({ limitBytes: 25, download: tenBytes });

    await files.open(1, book(1));
    await files.open(2, book(2));

    expect([1, 2].filter((id) => files.isCached(id, book(id)))).toEqual([1, 2]);
    expect(await readdir(dir)).toContain(".DS_Store");
  });
});

describe("remove and clear", () => {
  it("removes every cached file of one book", async () => {
    const files = cache();
    await files.open(1, pdf(10));
    await files.open(2, { format: "epub", size: 10, path: "/opds/download/2/epub/" });

    await files.remove(1);

    expect(files.isCached(1, pdf(10))).toBe(false);
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("clears every cached book and leaves other files alone", async () => {
    const files = cache();
    await files.open(1, pdf(10));
    await writeFile(join(dir, ".DS_Store"), "x");

    await files.clear();

    expect(await readdir(dir)).toEqual([".DS_Store"]);
  });

  it("cancels a download of the book being removed", async () => {
    const { download, release } = gatedDownload();
    const files = cache({ download });

    const opening = files.open(1, pdf(10)).catch((error: Error) => error);
    const removing = files.remove(1);
    await release(pdf(10).path);

    expect(await opening).toBeInstanceOf(DownloadCancelledError);
    await removing;
    expect(files.isCached(1, pdf(10))).toBe(false);
    expect(await readdir(dir)).toEqual([]);
  });

  it("cancels every download when the cache is cleared", async () => {
    const { download, release } = gatedDownload();
    const files = cache({ download });

    const opening = files.open(1, pdf(10)).catch((error: Error) => error);
    const clearing = files.clear();
    await release(pdf(10).path);

    expect(await opening).toBeInstanceOf(DownloadCancelledError);
    await clearing;
    expect(await readdir(dir)).toEqual([]);
  });

  it("cancels a download the cache is committing", async () => {
    let clearing: Promise<void> | undefined;
    const files: FileCache = createFileCache({
      dir,
      limitBytes: 1_000_000,
      download: async () => new Response("0123456789"),
      now: () => {
        clearing ??= files.clear();
        return new Date();
      },
    });

    const opened = await files.open(1, pdf(10)).catch((error: Error) => error);
    await clearing;

    expect(opened).toBeInstanceOf(DownloadCancelledError);
    expect(await readdir(dir)).toEqual([]);
  });

  it("cancels a download still waiting for the server to respond", async () => {
    let requested!: () => void;
    const requesting = new Promise<void>((resolve) => (requested = resolve));
    const files = cache({
      download: (_path, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason));
          requested();
        }),
    });

    const opening = files.open(1, pdf(10)).catch((error: Error) => error);
    await requesting;
    await files.clear();

    expect(await opening).toBeInstanceOf(DownloadCancelledError);
    expect(await readdir(dir)).toEqual([]);
  });
});
