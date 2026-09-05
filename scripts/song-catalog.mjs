import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const songsDirectory = fileURLToPath(
  new URL("../public/songs/", import.meta.url),
);

// Walk only real directories inside the collection; do not follow symlinks.
export async function scanSongs(root = songsDirectory) {
  const entries = [];
  async function walk(folder) {
    const directory = path.join(root, folder);
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    for (const child of children) {
      if (child.name.startsWith(".")) continue;
      const relative = folder ? folder + "/" + child.name : child.name;
      if (child.isDirectory()) {
        await walk(relative);
      } else if (child.isFile() && /\.txt$/i.test(child.name)) {
        const text = await readFile(path.join(directory, child.name), "utf8");
        // Ignore README/credits; let the game's parser report broken song files.
        if (/^\s*#(?:TITLE|BPM|MP3):/im.test(text)) {
          entries.push({ folder, songFile: child.name });
        }
      }
    }
  }
  await walk("");
  return entries;
}

export async function writeCatalog() {
  await mkdir(songsDirectory, { recursive: true });
  const entries = await scanSongs();
  const content =
    JSON.stringify(entries, null, 2).replace(/\n/g, "\r\n") + "\r\n";
  const target = path.join(songsDirectory, "catalog.json");
  let previous;
  try {
    previous = await readFile(target, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous !== content) await writeFile(target, content, "utf8");
  console.log("Catálogo atualizado: " + entries.length + " músicas.");
  return entries;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await writeCatalog();
}
