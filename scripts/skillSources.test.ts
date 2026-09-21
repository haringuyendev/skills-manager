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
