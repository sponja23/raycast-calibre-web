import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";
import { BookFile } from "./book";

export type OnProgress = (received: number, total: number) => void;

export interface FileCache {
  open(id: number, file: BookFile, onProgress?: OnProgress): Promise<string>;
  isCached(id: number, file: BookFile): boolean;
  remove(id: number): Promise<void>;
  clear(): Promise<void>;
}

export interface FileCacheOptions {
  dir: string;
  limitBytes: number;
  download: (path: string, signal: AbortSignal) => Promise<Response>;
  now?: () => Date;
}

export class DownloadCancelledError extends Error {
  constructor() {
    super("The download was cancelled");
    this.name = "DownloadCancelledError";
  }
}

interface Download {
  id: number;
  done: Promise<string>;
  listeners: Set<OnProgress>;
  controller: AbortController;
}

interface CachedFile {
  name: string;
  id: number;
  format: string;
  partial: boolean;
}

const MANAGED_NAME = /^(\d+)-\d+\.([^.]+)(\.part)?$/;

// The file size is the version key because OPDS `updated` is the date a book was added, which survives file replacement.
const fileName = (id: number, file: BookFile) => `${id}-${file.size}.${file.format}`;

function parseName(name: string): CachedFile | undefined {
  const match = MANAGED_NAME.exec(name);
  return match ? { name, id: Number(match[1]), format: match[2], partial: match[3] !== undefined } : undefined;
}

export function createFileCache({ dir, limitBytes, download, now = () => new Date() }: FileCacheOptions): FileCache {
  const downloads = new Map<string, Download>();
  const openedThisSession = new Set<string>();
  let lock: Promise<unknown> = Promise.resolve();

  // Every change to the directory's set of files runs through this queue, so eviction never races a commit or removal.
  function exclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = lock.then(task);
    lock = result.catch(() => undefined);
    return result;
  }

  const removeFile = (name: string) => rm(join(dir, name), { force: true });

  async function managedFiles() {
    const files = (await readdir(dir).catch(() => [])).flatMap((name) => parseName(name) ?? []);
    const withStats = await Promise.all(
      files.map(async (file) => {
        const stats = await stat(join(dir, file.name)).catch(() => undefined);
        return stats ? [{ ...file, size: stats.size, mtimeMs: stats.mtimeMs }] : [];
      }),
    );
    return withStats.flat();
  }

  async function fetchToPart(file: BookFile, part: string, entry: Download) {
    await mkdir(dir, { recursive: true });
    const { signal } = entry.controller;
    let received = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        for (const listener of entry.listeners) listener(received, file.size);
        callback(null, chunk);
      },
    });
    try {
      const response = await download(file.path, signal);
      await pipeline(Readable.fromWeb(response.body as ReadableStream), counter, createWriteStream(part), { signal });
    } catch (error) {
      await rm(part, { force: true });
      throw error;
    }
  }

  async function pruneVersions(keep: CachedFile) {
    for (const other of await managedFiles()) {
      if (other.id === keep.id && other.format === keep.format && other.name !== keep.name && !other.partial) {
        await removeFile(other.name);
      }
    }
  }

  async function evict() {
    const inFlight = new Set([...downloads.keys()].map((name) => `${name}.part`));
    const files = (await managedFiles()).sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= limitBytes) break;
      if (openedThisSession.has(file.name) || inFlight.has(file.name)) continue;
      await removeFile(file.name);
      total -= file.size;
    }
  }

  async function touch(name: string) {
    const openedAt = now();
    await utimes(join(dir, name), openedAt, openedAt);
    openedThisSession.add(name);
  }

  function startDownload(id: number, file: BookFile, name: string): Download {
    const entry: Download = { id, done: Promise.resolve(""), listeners: new Set(), controller: new AbortController() };
    entry.done = (async () => {
      const part = join(dir, `${name}.part`);
      await fetchToPart(file, part, entry);
      return exclusive(async () => {
        entry.controller.signal.throwIfAborted();
        await rename(part, join(dir, name));
        await touch(name);
        await pruneVersions(parseName(name)!);
        await evict();
        return join(dir, name);
      });
    })()
      .catch((error: unknown) => {
        throw entry.controller.signal.aborted ? new DownloadCancelledError() : error;
      })
      .finally(() => downloads.delete(name));
    downloads.set(name, entry);
    return entry;
  }

  async function cancelAndRemove(matches: (file: { id: number }) => boolean) {
    for (const entry of downloads.values()) if (matches(entry)) entry.controller.abort();
    await Promise.allSettled([...downloads.values()].filter(matches).map((entry) => entry.done));
    await exclusive(async () => {
      for (const file of await managedFiles()) if (matches(file)) await removeFile(file.name);
    });
  }

  return {
    async open(id, file, onProgress) {
      const name = fileName(id, file);
      if (existsSync(join(dir, name)) && !downloads.has(name)) {
        await touch(name);
        return join(dir, name);
      }
      const entry = downloads.get(name) ?? startDownload(id, file, name);
      if (onProgress) entry.listeners.add(onProgress);
      return entry.done;
    },
    isCached: (id, file) => existsSync(join(dir, fileName(id, file))),
    remove: (id) => cancelAndRemove((file) => file.id === id),
    clear: () => cancelAndRemove(() => true),
  };
}
