import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BookFile } from "./book";
import { FileCache, createFileCache } from "./file-cache";

const pdf = (size: number): BookFile => ({ format: "pdf", size, path: `/opds/download/1/pdf/` });

let dir: string;
let downloads: string[];
let clock: number;

function cache(options: { limitBytes?: number; download?: (path: string) => Promise<Response> } = {}): FileCache {
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
});

describe("eviction", () => {
  const book = (id: number): BookFile => ({ format: "pdf", size: 10, path: `/opds/download/${id}/pdf/` });
  const tenBytes = async () => new Response("0123456789");

  it("removes the least recently opened books once the cache passes its limit", async () => {
    const files = cache({ limitBytes: 25, download: tenBytes });

    await files.open(1, book(1));
    await files.open(2, book(2));
    await files.open(1, book(1));
    await files.open(3, book(3));

    expect([1, 2, 3].filter((id) => files.isCached(id, book(id)))).toEqual([1, 3]);
  });

  it("keeps the book just opened even when it alone exceeds the limit", async () => {
    const files = cache({ limitBytes: 5, download: tenBytes });

    await files.open(1, book(1));
    await files.open(2, book(2));

    expect([1, 2].filter((id) => files.isCached(id, book(id)))).toEqual([2]);
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

  it("clears the whole cache", async () => {
    const files = cache();
    await files.open(1, pdf(10));

    await files.clear();

    expect(files.isCached(1, pdf(10))).toBe(false);
  });
});
