import path from "node:path";

type PlatformName = NodeJS.Platform | "win32" | "linux" | "darwin";

export function normalizeForPlatform(pathname: string, platform: PlatformName = process.platform): string {
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const normalized = pathModule.normalize(pathname);
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function isPathEqualOrInside(
  candidate: string,
  parent: string,
  platform: PlatformName = process.platform
): boolean {
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const normalizedCandidate = stripTrailingSeparator(normalizeForPlatform(candidate, platform), pathModule);
  const normalizedParent = stripTrailingSeparator(normalizeForPlatform(parent, platform), pathModule);

  return (
    normalizedCandidate === normalizedParent ||
    normalizedCandidate.startsWith(`${normalizedParent}${pathModule.sep}`)
  );
}

export function isPathInsideBoundary(
  candidate: string,
  allowed: string[],
  platform: PlatformName = process.platform
): boolean {
  return allowed.some((parent) => isPathEqualOrInside(candidate, parent, platform));
}

export function isUnsafeWorkspaceRoot(
  pathname: string,
  env: Record<string, string | undefined> = process.env,
  platform: PlatformName = process.platform
): boolean {
  const pathModule = platform === "win32" ? path.win32 : path.posix;
  const normalized = stripTrailingSeparator(normalizeForPlatform(pathname, platform), pathModule);
  if (!normalized) return true;

  const root = stripTrailingSeparator(normalizeForPlatform(pathModule.parse(pathname).root, platform), pathModule);
  if (normalized === root) return true;

  const unsafeRoots = [
    env.USERPROFILE,
    env.HOME,
    env.WINDIR,
    env.SystemRoot,
    env.ProgramFiles,
    env["ProgramFiles(x86)"]
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => stripTrailingSeparator(normalizeForPlatform(value, platform), pathModule));

  if (unsafeRoots.some((unsafeRoot) => normalized === unsafeRoot)) {
    return true;
  }

  const segments = normalized.split(/[\\/]+/);
  return segments.includes(".git");
}

function stripTrailingSeparator(pathname: string, pathModule: typeof path.win32 | typeof path.posix): string {
  const parsed = pathModule.parse(pathname);
  let current = pathname;
  while (current.length > parsed.root.length && current.endsWith(pathModule.sep)) {
    current = current.slice(0, -1);
  }
  return current;
}
