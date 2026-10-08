import { Application, Toast, open, showToast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { BookFile } from "./book";
import { FileCache } from "./file-cache";

export async function downloadWithToast(files: FileCache, id: number, file: BookFile): Promise<string> {
  if (files.isCached(id, file)) return files.open(id, file);
  const toast = await showToast({ style: Toast.Style.Animated, title: "Downloading" });
  try {
    const path = await files.open(id, file, (received, total) => {
      toast.message = `${Math.floor((received / total) * 100)}%`;
    });
    await toast.hide();
    return path;
  } catch (error) {
    toast.style = Toast.Style.Failure;
    toast.title = "Download failed";
    toast.message = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

export async function openBook(files: FileCache, id: number, file: BookFile, app: Application) {
  let path: string;
  try {
    path = await downloadWithToast(files, id, file);
  } catch {
    return;
  }
  try {
    await open(path, app);
  } catch (error) {
    await showFailureToast(error, { title: `Could not open the book in ${app.name}` });
  }
}
