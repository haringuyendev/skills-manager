# Git Repository Filter for the Skill Library

## Intent

Git installation can import many skills from one repository. The Library
currently stores each skill independently, so users lose the repository as a
useful way to find and batch-select those skills after installation.

The goal is to make repository filtering available in the existing flat
Library without introducing a second repository-management subsystem.

## Goals

- Filter Library skills by their originating Git repository.
- Keep the existing flat Library layout and all current skill actions.
- Let multi-select and "Select all" operate on the filtered repository view.
- Group the same repository across different skill subpaths and branches.
- Support existing records that do not have resolved source metadata.
- Preserve the current source, preset, tag, search, and batch-action behavior.

## Non-goals

- No repository entity or repository-specific database table.
- No new Rust command, Tauri API, migration, or backup format.
- No repository-level fetch/update action.
- No custom repository names, default branches, or repository settings.
- No change to Project Workspace behavior.

## User experience

The Library remains a flat grid/list. A native repository select is added
beside the existing source filters and is shown when at least one Git skill is
available.

The default option is `All repos`, which leaves the current Library result
unchanged. Other options use a readable repository label and skill count, for
example `github.com/foo/bar (12)`. A tooltip can expose the full normalized
repository URL when the label is shortened.

Selecting a repository combines with the existing search, source, tag, and
preset filters. In multi-select mode, `Select all` selects the currently
visible result set, so batch update, tag, sync, enable/disable, and delete
continue to use their existing handlers.

When the selected repository no longer exists after a refresh or deletion,
the filter resets to `All repos`. Local/imported skills remain visible under
`All repos`; they are not assigned to a Git repository. Git records whose
source metadata cannot produce a valid repository key use `Other`.

Translations are added to `en.json`, `zh.json`, and `zh-TW.json` for the
repository filter label, `All repos`, and `Other`.

## Repository identity

Repository grouping is derived entirely from `ManagedSkill` metadata:

1. Only `source_type === "git"` participates in repository options.
2. Prefer `source_ref_resolved`, which represents the clone URL without the
   selected skill's subpath or branch.
3. Fall back to `source_ref` for older records.
4. Normalize the value by trimming whitespace, removing a trailing slash, and
   removing a trailing `.git` suffix.
5. Do not include branch or skill subpath in the grouping key.

The display label is derived from the normalized URL (host plus repository
path where possible). Invalid or missing values are assigned to `Other`
instead of throwing or hiding the skill.

This keeps the change compatible with current install metadata: each skill
still retains its own branch, subpath, revision, and update state.

## Data flow and implementation boundary

The change stays in the frontend Library flow:

- Derive repository options from `managedSkills` with a small pure helper.
- Add `repoFilter` state in `MySkills`.
- Add the repository predicate to the existing `filtered` `useMemo`.
- Include `repoFilter` in `useMultiSelect`'s `filterSignal`, allowing the
  existing selection-pruning behavior to remove hidden skills after a filter
  change.
- Reuse the existing `MultiSelectToolbar` and all batch handlers unchanged.

Expected files:

- `src/views/MySkills.tsx`
- `src/lib/skillSources.ts` for pure repository-key/label helpers
- `src/i18n/en.json`
- `src/i18n/zh.json`
- `src/i18n/zh-TW.json`

Rust code, SQLite schema, IPC types, backup metadata, and Project Workspace
files are out of scope.

## Edge cases and error handling

- A missing `source_ref_resolved` uses `source_ref`.
- A malformed URL is treated as `Other`; it does not break Library rendering.
- `.git` and trailing-slash variants resolve to the same repository.
- Different branches or nested skill paths in one repository resolve to the
  same repository option.
- A repository option is sorted by display label, with `Other` last.
- If no Git skills exist, the repository select is hidden.

## Verification

Run:

- `npm run lint`
- `npm run build`

Manually verify:

1. A Git repository with multiple skills appears as one option with the right
   count.
2. Selecting it filters the flat Library without changing card actions.
3. `Select all` after filtering selects only that repository's visible skills
   and batch actions operate on them.
4. URL variants, branches, and subpaths remain one repository group.
5. Local/imported/skills.sh skills remain available under `All repos`.
6. Deleting or refreshing the last skill in a selected repository resets the
   filter safely.
7. Missing or malformed source metadata appears under `Other` without an
   error.
