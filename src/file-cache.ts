import { createWriteStream, existsSync } from "node:fs";
import { mkdir, readdir, rename, rm, stat, utimes } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { ReadableStream } from "node:stream/web";
import { BookFile } from "./book";

export type Progress = (received: number, total: number) => void;

export interface FileCache {
  open(id: number, file: BookFile, onProgress?: Progress): Promise<string>;
  isCached(id: number, file: BookFile): boolean;
  remove(id: number): Promise<void>;
  clear(): Promise<void>;
}

export interface FileCacheOptions {
  dir: string;
  limitBytes: number;
  download: (path: string) => Promise<Response>;
  now?: () => Date;
}

const CACHED_NAME = /^(\d+)-\d+\.[^.]+$/;

// The file size is the version key because OPDS `updated` is the date a book was added, which survives file replacement.
const fileName = (id: number, file: BookFile) => `${id}-${file.size}.${file.format}`;

export function createFileCache({ dir, limitBytes, download, now = () => new Date() }: FileCacheOptions): FileCache {
  const inFlight = new Map<string, Promise<string>>();

  async function cachedFiles() {
    const names = (await readdir(dir).catch(() => [])).filter((name) => CACHED_NAME.test(name));
    return Promise.all(
      names.map(async (name) => {
        const { size, mtimeMs } = await stat(join(dir, name));
        return { name, id: Number(CACHED_NAME.exec(name)![1]), size, mtimeMs };
      }),
    );
  }

  async function fetchFile(id: number, file: BookFile, target: string, onProgress?: Progress) {
    await mkdir(dir, { recursive: true });
    const partial = `${target}.part`;
    try {
      const response = await download(file.path);
      const total = Number(response.headers.get("content-length")) || file.size;
      let received = 0;
      const counter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length;
          onProgress?.(received, total);
          callback(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(response.body as ReadableStream), counter, createWriteStream(partial));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }

    const name = fileName(id, file);
    for (const other of await cachedFiles()) {
      if (other.id === id && other.name !== name && other.name.endsWith(`.${file.format}`)) {
        await rm(join(dir, other.name), { force: true });
      }
    }
  }

  async function evict(keep: string) {
    const files = (await cachedFiles()).sort((a, b) => a.mtimeMs - b.mtimeMs);
    let total = files.reduce((sum, file) => sum + file.size, 0);
    for (const file of files) {
      if (total <= limitBytes) break;
      if (file.name === keep) continue;
      await rm(join(dir, file.name), { force: true });
      total -= file.size;
    }
  }

  async function open(id: number, file: BookFile, onProgress?: Progress) {
    const name = fileName(id, file);
    const target = join(dir, name);
    const downloaded = !existsSync(target);
    if (downloaded) await fetchFile(id, file, target, onProgress);
    const openedAt = now();
    await utimes(target, openedAt, openedAt);
    if (downloaded) await evict(name);
    return target;
  }

  return {
    open(id, file, onProgress) {
      const name = fileName(id, file);
      const pending = inFlight.get(name) ?? open(id, file, onProgress).finally(() => inFlight.delete(name));
      inFlight.set(name, pending);
      return pending;
    },
    isCached: (id, file) => existsSync(join(dir, fileName(id, file))),
    async remove(id) {
      for (const file of await cachedFiles()) {
        if (file.id === id) await rm(join(dir, file.name), { force: true });
      }
    },
    async clear() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}
