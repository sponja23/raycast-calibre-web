import { describe, expect, it } from "vitest";
import { AuthError, CatalogNotFoundError, InvalidServerUrlError, NetworkError, ServerError } from "./calibre-web";
import { describeDownloadFailure, describeRefreshFailure } from "./failure";
import { DownloadCancelledError } from "./file-cache";

describe("describeRefreshFailure", () => {
  it("sends the user to the preferences when the server refuses the credentials", () => {
    expect(describeRefreshFailure(new AuthError(), false)).toEqual({
      title: "Calibre-Web rejected the credentials",
      fixInPreferences: true,
    });
  });

  it("sends the user to the preferences when the server URL is not http or https", () => {
    expect(describeRefreshFailure(new InvalidServerUrlError("books.example.com"), false)).toEqual({
      title: "Invalid server URL",
      message: "Use an http:// or https:// URL, such as https://books.example.com",
      fixInPreferences: true,
    });
  });

  it("points at the Recently Added view when the server has no catalog at the URL", () => {
    expect(describeRefreshFailure(new CatalogNotFoundError(), false)).toEqual({
      title: "No OPDS catalog at this URL",
      message: "Check the server URL, and that the user can see Recently Added books",
      fixInPreferences: true,
    });
  });

  it("says the cached library is shown when the server is unreachable", () => {
    expect(describeRefreshFailure(new NetworkError(new TypeError("fetch failed")), true)).toEqual({
      title: "Could not reach the server",
      message: "Showing the cached library",
      fixInPreferences: false,
    });
    expect(describeRefreshFailure(new NetworkError(new TypeError("fetch failed")), false)).toEqual({
      title: "Could not reach the server",
      fixInPreferences: false,
    });
  });

  it("passes any other failure's message through", () => {
    expect(describeRefreshFailure(new ServerError(500), false)).toEqual({
      title: "Could not refresh the library",
      message: "The server responded with HTTP 500",
      fixInPreferences: false,
    });
  });
});

describe("describeDownloadFailure", () => {
  it("stays silent when the download was cancelled", () => {
    expect(describeDownloadFailure(new DownloadCancelledError())).toBeUndefined();
  });

  it("blames the download role when the server refuses the download", () => {
    expect(describeDownloadFailure(new AuthError())).toEqual({
      title: "Calibre-Web refused the download",
      message: "The user needs the download role",
      fixInPreferences: true,
    });
  });

  it("sends the user to the preferences when the server URL is not http or https", () => {
    expect(describeDownloadFailure(new InvalidServerUrlError("books.example.com"))).toMatchObject({
      title: "Invalid server URL",
      fixInPreferences: true,
    });
  });

  it("says the book is gone when the server has no such file", () => {
    expect(describeDownloadFailure(new ServerError(404))).toEqual({
      title: "Download failed",
      message: "The book is no longer on the server",
      fixInPreferences: false,
    });
  });

  it.each([
    [new ServerError(500), "The server responded with HTTP 500"],
    [new NetworkError(new TypeError("fetch failed")), "Could not reach the server"],
    [new Error("disk full"), "disk full"],
  ])("passes the message of %s through", (error, message) => {
    expect(describeDownloadFailure(error)).toEqual({ title: "Download failed", message, fixInPreferences: false });
  });
});
