import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function readTextIfExists(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return "";
    throw error;
  }
}

export async function writeTextFile(path: string, text: string): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const existingMode = await stat(path).then((stats) => stats.mode, () => undefined);
  const tempPath = join(dir, `.${process.pid}-${randomBytes(8).toString("hex")}.tmp`);
  await writeFile(tempPath, text, {
    encoding: "utf8",
    mode: existingMode ?? 0o600
  });
  try {
    await rename(tempPath, path);
    if (existingMode !== undefined) {
      await chmod(path, existingMode).catch(() => undefined);
    }
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
