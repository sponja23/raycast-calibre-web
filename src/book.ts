export interface BookFile {
  format: string;
  size: number;
  path: string;
}

export interface Book {
  id: number;
  title: string;
  authors: string[];
  tags: string[];
  year?: number;
  publisher?: string;
  language?: string;
  summary?: string;
  updated: string;
  files: BookFile[];
}

const FORMAT_PREFERENCE = ["pdf", "epub", "djvu", "mobi"];

const READER_FORMATS = ["pdf", "epub", "djvu", "djv", "txt", "cbz", "cbr", "cbt"];

const SIZE_UNITS = ["B", "KB", "MB", "GB"];

const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export function preferredFile(book: Book): BookFile | undefined {
  return filesByPreference(book)[0];
}

export function readerFile(book: Book): BookFile | undefined {
  return byPreference(book.files.filter((file) => READER_FORMATS.includes(file.format)))[0];
}

export function filesByPreference(book: Book): BookFile[] {
  return byPreference(book.files);
}

function byPreference(files: BookFile[]): BookFile[] {
  const rank = (file: BookFile) => {
    const index = FORMAT_PREFERENCE.indexOf(file.format);
    return index === -1 ? FORMAT_PREFERENCE.length : index;
  };
  return [...files].sort((a, b) => rank(a) - rank(b));
}

export function formatSize(bytes: number): string {
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < SIZE_UNITS.length - 1) {
    size /= 1024;
    unit++;
  }
  return unit === 0 ? `${size} B` : `${size.toFixed(1)} ${SIZE_UNITS[unit]}`;
}

export function languageName(code: string): string {
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}
