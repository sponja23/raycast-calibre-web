const SIZE_UNITS = ["B", "KB", "MB", "GB"];

const LANGUAGE_NAMES = new Intl.DisplayNames(["en"], { type: "language" });

const MARKDOWN_SYNTAX = /[\\`*_{}[\]()#+\-.!<>|~]/g;

export function formatSize(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${unit === 0 ? size : size.toFixed(1)} ${SIZE_UNITS[unit]}`;
}

export function languageNames(codes: string[]): string {
  return codes.map(languageName).join(", ");
}

function languageName(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

export function escapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_SYNTAX, "\\$&");
}
