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
  updated: string;
  files: BookFile[];
}

const FORMAT_PREFERENCE = ["pdf", "epub", "djvu", "mobi"];

export function preferredFile(book: Book): BookFile | undefined {
  const rank = (file: BookFile) => {
    const index = FORMAT_PREFERENCE.indexOf(file.format);
    return index === -1 ? FORMAT_PREFERENCE.length : index;
  };
  return [...book.files].sort((a, b) => rank(a) - rank(b))[0];
}
