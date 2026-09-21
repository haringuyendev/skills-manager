import type { ManagedSkill } from "./tauri";

export const ALL_REPOS_FILTER = "";
export const OTHER_REPOSITORY_KEY = "__other__";

export interface GitRepositoryFilterOption {
  key: string;
  label: string;
  count: number;
  isOther: boolean;
}

type SkillSource = Pick<ManagedSkill, "source_type" | "source_ref" | "source_ref_resolved">;

function normalizeRef(ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  let urlStr = trimmed;
  // Check SSH format: git@github.com:foo/bar.git or similar (user@host:path)
  const sshMatch = urlStr.match(/^([^@]+)@([^:]+):(.+)$/);
  if (sshMatch) {
    const [, , host, path] = sshMatch;
    urlStr = `ssh://${host}/${path}`;
  }

  try {
    let parsed: URL;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(urlStr)) {
      parsed = new URL(urlStr);
    } else {
      // Try parsing as HTTPS URL if protocol is omitted
      parsed = new URL(`https://${urlStr}`);
    }

    const host = parsed.hostname.toLowerCase();
    if (!host || !host.includes(".")) {
      return null;
    }

    let pathname = parsed.pathname;

    // Handle /tree/<branch>/... path (e.g. https://github.com/foo/bar/tree/main/skills/baz)
    const treeIndex = pathname.indexOf("/tree/");
    if (treeIndex !== -1) {
      pathname = pathname.substring(0, treeIndex);
    }

    // Normalize multiple slashes and trim trailing slash
    pathname = pathname.replace(/\/+/g, "/").replace(/\/+$/, "");

    // Remove trailing .git
    if (pathname.endsWith(".git")) {
      pathname = pathname.slice(0, -4);
    }

    // Path must have at least one segment (e.g. /owner/repo or /repo)
    if (!pathname || pathname === "/") {
      return null;
    }

    // Strip leading slash for key
    const cleanPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    if (!cleanPath) {
      return null;
    }

    return `${host}/${cleanPath.toLowerCase()}`;
  } catch {
    return null;
  }
}

export function getGitRepositoryKey(skill: SkillSource): string | null {
  if (skill.source_type !== "git") {
    return null;
  }

  const candidate = skill.source_ref_resolved || skill.source_ref;
  if (!candidate) {
    return OTHER_REPOSITORY_KEY;
  }

  const normalized = normalizeRef(candidate);
  if (!normalized) {
    return OTHER_REPOSITORY_KEY;
  }

  return normalized;
}

export function getGitRepositoryOptions(
  skills: readonly SkillSource[],
): GitRepositoryFilterOption[] {
  const counts = new Map<string, number>();
  let otherCount = 0;

  for (const skill of skills) {
    const key = getGitRepositoryKey(skill);
    if (!key) continue;

    if (key === OTHER_REPOSITORY_KEY) {
      otherCount += 1;
    } else {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const sortedKeys = Array.from(counts.keys()).sort((a, b) => a.localeCompare(b));

  const options: GitRepositoryFilterOption[] = sortedKeys.map((key) => ({
    key,
    label: key,
    count: counts.get(key)!,
    isOther: false,
  }));

  if (otherCount > 0) {
    options.push({
      key: OTHER_REPOSITORY_KEY,
      label: "Other",
      count: otherCount,
      isOther: true,
    });
  }

  return options;
}
