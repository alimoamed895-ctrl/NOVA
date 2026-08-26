import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default async function handler(req, res) {
  try {
    const currentDir = path.dirname(
      fileURLToPath(import.meta.url)
    );

    const html = await readFile(
      path.join(currentDir, "index.html"),
      "utf8"
    );

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    );

    res.end(html);

  } catch (error) {
    console.error(error);

    res.statusCode = 500;

    res.setHeader(
      "Content-Type",
      "text/plain; charset=utf-8"
    );

    res.end(
      "Education GPT: فشل تحميل الصفحة."
    );
  }
}
