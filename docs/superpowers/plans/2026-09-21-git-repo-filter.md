# Git Repository Filter for the Skill Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository filter to the existing flat Library so Git-installed skills can be filtered and batch-selected by their originating repository.

**Architecture:** Derive repository identity in the frontend from each `ManagedSkill`'s existing `source_ref_resolved`/`source_ref` metadata. A small pure helper normalizes Git URLs and builds sorted repository options; `MySkills` adds that value to the existing filter pipeline and `useMultiSelect` signal, leaving batch handlers, Tauri commands, and storage unchanged.

**Tech Stack:** React 19, TypeScript, Vite, react-i18next, Node 24 native test runner, existing ESLint/build scripts.

**Spec:** `docs/superpowers/specs/2026-09-21-git-repo-filter-design.md`

## Global Constraints

- No repository entity or repository-specific database table.
- No new Rust command, Tauri API, migration, or backup format.
- No repository-level fetch/update action.
- No custom repository names, default branches, or repository settings.
- No change to Project Workspace behavior.
- Only `source_type === "git"` participates in repository options.
- Prefer `source_ref_resolved`, then fall back to `source_ref`.
- Branch and skill subpath must not be part of the grouping key.
- Invalid or missing Git metadata must render as `Other`, not throw or hide the skill.

## Review Focus

- A legacy Git skill with only `source_ref` must join the correct repository — covered by the helper fallback test in Task 1.
- `.git`, trailing-slash, branch, and nested-skill-path variants must share one key — covered by normalization tests in Task 1.
- Local/imported/skills.sh skills must remain outside repository options, while invalid Git metadata appears as `Other` — covered by option-building tests in Task 1.
- Changing the repository filter must prune hidden selections, and `Select all` must select only visible repository results — covered by the existing `useMultiSelect` contract plus the manual interaction check in Task 2.
- Removing the final skill in the active repository must reset the filter to `All repos` — covered by the refresh/delete manual check in Task 2.

## File Map

- Create `src/lib/skillSources.ts`: pure repository-key, label, and option-building logic.
- Create `scripts/skillSources.test.ts`: native Node tests for normalization and grouping edge cases.
- Modify `package.json`: add the focused native test command.
- Modify `src/views/MySkills.tsx`: derive repository options, apply repository filtering, reset stale selections, and render the native select.
- Modify `src/i18n/en.json`: English repository filter copy.
- Modify `src/i18n/zh.json`: Simplified Chinese repository filter copy.
- Modify `src/i18n/zh-TW.json`: Traditional Chinese repository filter copy.

### Task 1: Add pure Git repository grouping helpers

**Files:**

- Create: `src/lib/skillSources.ts`
- Create: `scripts/skillSources.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `ManagedSkill`-shaped values with `source_type`, `source_ref`, and `source_ref_resolved`.
- Produces: `getGitRepositoryKey`, `getGitRepositoryOptions`, `ALL_REPOS_FILTER`, `OTHER_REPOSITORY_KEY`, and `GitRepositoryFilterOption` for `MySkills`.

- [ ] **Step 1: Write the failing native tests**

Create `scripts/skillSources.test.ts` using `node:test` and `node:assert/strict`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import type { ManagedSkill } from "../src/lib/tauri.ts";
import {
  ALL_REPOS_FILTER,
  OTHER_REPOSITORY_KEY,
  getGitRepositoryKey,
  getGitRepositoryOptions,
} from "../src/lib/skillSources.ts";

type SkillSource = Pick<ManagedSkill, "source_type" | "source_ref" | "source_ref_resolved">;

const gitSkill = (overrides: Partial<SkillSource> = {}): SkillSource => ({
  source_type: "git",
  source_ref: null,
  source_ref_resolved: null,
  ...overrides,
});

test("uses resolved URL and normalizes git suffix and trailing slash", () => {
  assert.equal(
    getGitRepositoryKey(gitSkill({
      source_ref_resolved: "https://github.com/foo/bar.git/",
    })),
    "github.com/foo/bar",
  );
});

test("falls back to source_ref and removes GitHub tree branch and skill path", () => {
  assert.equal(
    getGitRepositoryKey(gitSkill({
      source_ref: "https://github.com/foo/bar/tree/main/skills/baz",
    })),
    "github.com/foo/bar",
  );
});

test("normalizes SSH repository refs", () => {
  assert.equal(
    getGitRepositoryKey(gitSkill({
      source_ref_resolved: "git@github.com:foo/bar.git",
    })),
    "github.com/foo/bar",
  );
});

test("excludes non-Git skills and groups invalid Git metadata as Other", () => {
  const options = getGitRepositoryOptions([
    gitSkill({ source_ref_resolved: "not a repository" }),
    { source_type: "local", source_ref: "/tmp/local", source_ref_resolved: null },
  ]);

  assert.deepEqual(options, [{
    key: OTHER_REPOSITORY_KEY,
    label: "Other",
    count: 1,
    isOther: true,
  }]);
});

test("counts and sorts repositories by normalized label", () => {
  const options = getGitRepositoryOptions([
    gitSkill({ source_ref_resolved: "https://github.com/zeta/tools.git" }),
    gitSkill({ source_ref_resolved: "https://github.com/acme/tools" }),
    gitSkill({ source_ref_resolved: "https://github.com/zeta/tools/tree/main/one" }),
  ]);

  assert.deepEqual(options, [
    { key: "github.com/acme/tools", label: "github.com/acme/tools", count: 1, isOther: false },
    { key: "github.com/zeta/tools", label: "github.com/zeta/tools", count: 2, isOther: false },
  ]);
  assert.equal(ALL_REPOS_FILTER, "");
});
```

- [ ] **Step 2: Add the focused test command and run it to verify failure**

Add this script to `package.json` without adding a dependency:

```json
"test:skill-sources": "node --experimental-strip-types --test scripts/skillSources.test.ts"
```

Run:

```bash
npm run test:skill-sources
```

Expected: FAIL because `src/lib/skillSources.ts` and its exports do not exist yet.

- [ ] **Step 3: Write the minimal helper**

Create `src/lib/skillSources.ts` with these exact public shapes:

```ts
export const ALL_REPOS_FILTER = "";
export const OTHER_REPOSITORY_KEY = "__other__";

export interface GitRepositoryFilterOption {
  key: string;
  label: string;
  count: number;
  isOther: boolean;
}

export function getGitRepositoryKey(
  skill: Pick<ManagedSkill, "source_type" | "source_ref" | "source_ref_resolved">,
): string | null;

export function getGitRepositoryOptions(
  skills: readonly Pick<ManagedSkill, "source_type" | "source_ref" | "source_ref_resolved">[],
): GitRepositoryFilterOption[];
```

Implementation rules:

1. Return `null` for non-Git skills.
2. Try `source_ref_resolved`, then `source_ref`; skip an empty or invalid value.
3. Accept URL-style refs and SSH refs such as `git@github.com:foo/bar.git` by converting SSH syntax to a host/path representation.
4. Remove query/fragment, a trailing slash, and a trailing `.git` suffix.
5. If a path contains `/tree/<branch>`, keep only the repository path before `/tree`.
6. Return the lower-case `host/path` key; preserve nested host paths for self-hosted Git services.
7. If no candidate normalizes successfully, return `OTHER_REPOSITORY_KEY` for every Git skill and let `null` remain reserved for non-Git skills.
8. Build counts with a `Map`, sort normal repositories by label, and put `Other` last.

Use a type-only import for `ManagedSkill` so the helper has no runtime app dependency:

```ts
import type { ManagedSkill } from "./tauri";
```

- [ ] **Step 4: Run the focused tests and type checks**

Run:

```bash
npm run test:skill-sources
npm run lint
```

Expected: all helper tests PASS and ESLint exits 0.

- [ ] **Step 5: Commit the helper task**

```bash
git add package.json src/lib/skillSources.ts scripts/skillSources.test.ts
git commit -m "feat: add git repository grouping helpers"
```

### Task 2: Add repository filtering and repository-scoped selection to Library

**Files:**

- Modify: `src/views/MySkills.tsx:45-52,152-184,285-351,1229-1285`

**Interfaces:**

- Consumes: `getGitRepositoryKey`, `getGitRepositoryOptions`, and `ALL_REPOS_FILTER` from Task 1.
- Produces: a `repoFilter` state value that participates in the existing filtered list and `useMultiSelect` pruning signal.

- [ ] **Step 1: Add repository state and derived options**

Import the helper symbols and add:

```ts
const [repoFilter, setRepoFilter] = useState(ALL_REPOS_FILTER);

const repoOptions = useMemo(
  () => getGitRepositoryOptions(skills),
  [skills],
);
```

Reset a stale repository selection when the skill list changes:

```ts
useEffect(() => {
  if (
    repoFilter !== ALL_REPOS_FILTER &&
    !repoOptions.some((option) => option.key === repoFilter)
  ) {
    setRepoFilter(ALL_REPOS_FILTER);
  }
}, [repoFilter, repoOptions]);
```

- [ ] **Step 2: Add the repository predicate to the existing filtered pipeline**

Place the predicate after the search check and before source/tag/preset checks:

```ts
if (
  repoFilter !== ALL_REPOS_FILTER &&
  getGitRepositoryKey(skill) !== repoFilter
) {
  return false;
}
```

Add `repoFilter` to the `filtered` memo dependency list. Do not alter the existing sort order or any batch handler.

- [ ] **Step 3: Make repository changes prune selections**

Add `repoFilter` to the JSON array passed as `filterSignal`:

```ts
filterSignal: JSON.stringify([
  search,
  [...sourceFilters].sort(),
  [...tagFilters].sort(),
  filterMode,
  repoFilter,
  viewedPreset?.id ?? null,
]),
```

Do not modify `useMultiSelect`; its existing `filtered`-based pruning and `handleSelectAll` already provide the required repository-scoped behavior.

- [ ] **Step 4: Render the native repository select**

Add the select to the filter row beside the source pills. Render it only when `repoOptions.length > 0`, use the full normalized `label` as the visible option text, and append the count:

```tsx
{repoOptions.length > 0 && (
  <label className="inline-flex items-center gap-1.5 text-[12px] text-muted">
    <span className="sr-only">{t("mySkills.repositoryFilter.label")}</span>
    <select
      value={repoFilter}
      onChange={(event) => setRepoFilter(event.target.value)}
      aria-label={t("mySkills.repositoryFilter.label")}
      className="app-input h-7 py-0 text-[12px] font-medium"
    >
      <option value={ALL_REPOS_FILTER}>
        {t("mySkills.repositoryFilter.all")}
      </option>
      {repoOptions.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label} ({option.count})
        </option>
      ))}
    </select>
  </label>
)}
```

Keep the select outside the source-pill loop so source filters and repository filtering remain independent. Do not add a repository filter to non-Git source types.

- [ ] **Step 5: Run the app checks**

Run:

```bash
npm run test:skill-sources
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Manually verify the interaction contract**

Using a library containing two or more skills from one Git repository:

1. Confirm the repository select appears with one option and the correct count.
2. Select the repository and confirm only its skills remain in both grid and list views.
3. Enter multi-select mode, click `Select all`, and confirm the selected count equals the visible repository result count.
4. Run one non-destructive batch action such as tag edit or update; confirm no skill outside the selected repository is included.
5. Change the repository filter and confirm selections hidden by the filter are pruned.
6. Delete or refresh the final skill in the selected repository and confirm the select returns to `All repos`.

- [ ] **Step 7: Commit the Library integration task**

```bash
git add src/views/MySkills.tsx
git commit -m "feat: filter library skills by git repository"
```

### Task 3: Add translated repository filter copy and finish verification

**Files:**

- Modify: `src/i18n/en.json:400-406`
- Modify: `src/i18n/zh.json:400-406`
- Modify: `src/i18n/zh-TW.json:370-376`
- Modify: `src/views/MySkills.tsx` (localized `Other` option label)

**Interfaces:**

- Consumes: the translation keys used by the `MySkills` select in Task 2.
- Produces: localized repository filter label, default option, and fallback option.

- [ ] **Step 1: Add matching translation keys**

Add the same object shape under `mySkills` in all three locale files:

```json
"repositoryFilter": {
  "label": "Repository",
  "all": "All repos",
  "other": "Other"
}
```

Use these translations:

```json
// zh.json
"repositoryFilter": {
  "label": "仓库",
  "all": "全部仓库",
  "other": "其他"
}

// zh-TW.json
"repositoryFilter": {
  "label": "儲存庫",
  "all": "全部儲存庫",
  "other": "其他"
}
```

The helper's `Other` option must use `t("mySkills.repositoryFilter.other")` in the view rather than hard-coding English. Pass the translated label when mapping `repoOptions` to `<option>` so the helper remains locale-independent.

- [ ] **Step 2: Adjust the option rendering for localized `Other`**

Keep repository keys and counts from `skillSources.ts`, but render the fallback label through i18n:

```tsx
const optionLabel = option.isOther
  ? t("mySkills.repositoryFilter.other")
  : option.label;
```

Use `optionLabel` in the `<option>` text while retaining `option.key` as the stable value.

- [ ] **Step 3: Validate locale JSON, lint, build, and focused tests**

Run:

```bash
npm run test:skill-sources
npm run lint
npm run build
```

Expected: all commands exit 0 with no TypeScript, ESLint, or locale parse errors.

- [ ] **Step 4: Commit the localization task**

```bash
git add src/i18n/en.json src/i18n/zh.json src/i18n/zh-TW.json src/views/MySkills.tsx
git commit -m "feat: localize git repository filter"
```

- [ ] **Step 5: Final review**

Run:

```bash
git diff HEAD~3..HEAD --stat
git status --short
```

Expected: only the helper/test/package script, `MySkills`, and three locale files are changed by implementation; the working tree is clean. Confirm no Rust, migration, Project Workspace, or backup files changed.
