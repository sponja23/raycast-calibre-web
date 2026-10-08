import { AuthError, CatalogNotFoundError, InvalidServerUrlError, NetworkError, ServerError } from "./calibre-web";
import { DownloadCancelledError } from "./file-cache";

export interface Failure {
  title: string;
  message?: string;
  fixInPreferences: boolean;
}

const invalidServerUrl: Failure = {
  title: "Invalid server URL",
  message: "Use an http:// or https:// URL, such as https://books.example.com",
  fixInPreferences: true,
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const downloadFailed = (message: string): Failure => ({ title: "Download failed", message, fixInPreferences: false });

export function describeRefreshFailure(error: unknown, hasCachedBooks: boolean): Failure {
  if (error instanceof AuthError) return { title: "Calibre-Web rejected the credentials", fixInPreferences: true };
  if (error instanceof InvalidServerUrlError) return invalidServerUrl;
  if (error instanceof CatalogNotFoundError) {
    return {
      title: "No OPDS catalog at this URL",
      message: "Check the server URL, and that the user can see Recently Added books",
      fixInPreferences: true,
    };
  }
  if (error instanceof NetworkError) {
    return {
      title: "Could not reach the server",
      message: hasCachedBooks ? "Showing the cached library" : undefined,
      fixInPreferences: false,
    };
  }
  return { title: "Could not refresh the library", message: messageOf(error), fixInPreferences: false };
}

export function describeDownloadFailure(error: unknown): Failure | undefined {
  if (error instanceof DownloadCancelledError) return undefined;
  // The catalog already loaded with these credentials, so a 401 on download means the user lacks the download role.
  if (error instanceof AuthError) {
    return {
      title: "Calibre-Web refused the download",
      message: "The user needs the download role",
      fixInPreferences: true,
    };
  }
  if (error instanceof InvalidServerUrlError) return invalidServerUrl;
  if (error instanceof ServerError && error.status === 404) {
    return downloadFailed("The book is no longer on the server");
  }
  return downloadFailed(messageOf(error));
}
