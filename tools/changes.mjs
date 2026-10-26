// Reads the commits since the last release and decides the next version bump from their
// messages (Conventional Commits). Also used for the release notes.
//
//   node tools/changes.mjs <since-ref>          -> prints the bump: major | minor | patch | none
//   node tools/changes.mjs <since-ref> --notes  -> prints a "What's changed" Markdown section
//
// Rules:  "feat!: …" or "BREAKING CHANGE" -> major,  "feat: …" -> minor,
//         "fix:", "perf:", "refactor:" and messages without a type -> patch,
//         "docs:", "chore:", "ci:", "test:", "style:", "build:" alone -> no release.
import { execFileSync } from "node:child_process";

const [since = "", flag] = process.argv.slice(2);
const range = since ? [`${since}..HEAD`] : ["HEAD"];
let raw = "";
try {
  raw = execFileSync("git", ["log", ...range, "--no-merges", "--format=%s%x1f%b%x1e"], { encoding: "utf8" });
} catch {
  raw = execFileSync("git", ["log", "HEAD", "--no-merges", "--format=%s%x1f%b%x1e"], { encoding: "utf8" });
}

const QUIET = new Set(["docs", "chore", "ci", "test", "tests", "style", "build"]);
const commits = raw
  .split("\x1e")
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [subject = "", body = ""] = c.split("\x1f");
    const m = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/.exec(subject.trim());
    const type = m ? m[1].toLowerCase() : "";
    return {
      subject: subject.trim(),
      text: m ? m[4] : subject.trim(),
      scope: m?.[2] ?? "",
      type,
      breaking: Boolean(m?.[3]) || /BREAKING[ -]CHANGE/.test(body),
    };
  })
  .filter((c) => !/^chore\(release\)/i.test(c.subject));

const levels = { none: 0, patch: 1, minor: 2, major: 3 };
let bump = "none";
const raise = (level) => {
  if (levels[level] > levels[bump]) bump = level;
};
for (const c of commits) {
  if (c.breaking) raise("major");
  else if (c.type === "feat") raise("minor");
  else if (!QUIET.has(c.type)) raise("patch");
}

if (flag !== "--notes") {
  console.log(bump);
} else {
  const groups = [
    ["Breaking changes", (c) => c.breaking],
    ["New", (c) => !c.breaking && c.type === "feat"],
    ["Fixes", (c) => !c.breaking && (c.type === "fix" || c.type === "perf")],
    ["Other changes", (c) => !c.breaking && !["feat", "fix", "perf"].includes(c.type) && !QUIET.has(c.type)],
  ];
  const lines = ["### What's changed", ""];
  for (const [title, test] of groups) {
    const items = commits.filter(test);
    if (!items.length) continue;
    lines.push(`**${title}**`, "");
    for (const c of items) lines.push(`- ${c.scope ? `**${c.scope}:** ` : ""}${c.text}`);
    lines.push("");
  }
  if (lines.length === 2) lines.push("Maintenance only.", "");
  console.log(lines.join("\n"));
}
