import { Application, Toast, open, showToast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { BookFile } from "./book";
import { describeDownloadFailure } from "./failure";
import { showFailure } from "./failure-toast";
import { FileCache } from "./file-cache";

async function downloadWithToast(cache: FileCache, id: number, file: BookFile): Promise<string> {
  // Skips the toast for cached books, which would otherwise flash on every open.
  if (cache.isCached(id, file)) return cache.open(id, file);
  const toast = await showToast({ style: Toast.Style.Animated, title: "Downloading" });
  try {
    const path = await cache.open(id, file, (received, total) => {
      toast.message = `${Math.min(100, Math.floor((received / total) * 100))}%`;
    });
    await toast.hide();
    return path;
  } catch (error) {
    await showFailure(describeDownloadFailure(error), toast);
    throw error;
  }
}

export async function openBook(cache: FileCache, id: number, file: BookFile, app?: Application) {
  let path: string;
  try {
    path = await downloadWithToast(cache, id, file);
  } catch {
    return;
  }
  try {
    await open(path, app);
  } catch (error) {
    await showFailureToast(error, {
      title: app ? `Could not open the book in ${app.name}` : "Could not open the book",
    });
  }
}
