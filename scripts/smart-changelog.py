#!/usr/bin/env python3
"""
Generate smart-changelog-<version>.md from git history.
Expects conventional commits (feat:, fix:, etc.); otherwise groups under Changed.
"""
from __future__ import annotations

import re
import subprocess
import sys
from datetime import datetime, timezone

MAX_COMMITS = 300
# v1.2.3 or v1.2.3-beta.1 (not --minor / flags)
VERSION_ARG = re.compile(r"^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+.]?[0-9A-Za-z.-]*)?$")
MERGE_LINE = re.compile(r"^Merge (branch|remote-tracking|pull request)\b", re.I)
# feat!, feat(scope)!, feat, feat(scope):
CC_PREFIX = re.compile(
    r"^(?P<type>[a-z]+)(?P<scope>\([^)]+\))?(?P<breaking>!)?:\s*(?P<subj>.+)$",
    re.I,
)


def run_git(args: list[str]) -> str:
    r = subprocess.run(
        ["git", *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if r.returncode != 0:
        return ""
    return r.stdout.strip()


def tag_exists(tag: str) -> bool:
    if not tag or tag.lower() == "none":
        return False
    return bool(run_git(["rev-parse", "--verify", tag]))


def subject_lines(previous_tag: str | None) -> list[str]:
    base = ["log", "--pretty=format:%s", "--no-merges", f"-n{MAX_COMMITS}"]
    if previous_tag and tag_exists(previous_tag):
        out = run_git([*base, f"{previous_tag}..HEAD"])
    else:
        out = run_git(base)
    if not out:
        return []
    lines = [ln.strip() for ln in out.splitlines() if ln.strip()]
    return [ln for ln in lines if not MERGE_LINE.match(ln)]


def strip_cc(msg: str) -> tuple[str, str | None]:
    """
    Return (subject, type_lower_or_none).
    """
    m = CC_PREFIX.match(msg)
    if not m:
        return msg, None
    return m.group("subj").strip(), m.group("type").lower()


def release_kind(version: str) -> tuple[str, str]:
    m = re.match(r"^v(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$", version)
    if not m:
        return "Pre-release", "🔧"
    major, minor, patch = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if patch == 0 and minor == 0:
        return "Major Release", "🚀"
    if patch == 0:
        return "Minor Release", "✨"
    return "Patch Release", "🐛"


def categorize(subjects: list[str]) -> dict[str, list[str]]:
    buckets: dict[str, list[str]] = {
        "added": [],
        "changed": [],
        "fixed": [],
        "removed": [],
        "docs": [],
        "security": [],
        "perf": [],
    }
    for raw in subjects:
        body, typ = strip_cc(raw)
        breaking = bool(re.search(r"[!](?=:)", raw))
        if not typ:
            buckets["changed"].append(raw)
            continue
        if breaking:
            buckets["changed"].append(f"BREAKING: {body}")
            continue
        if typ == "feat" or typ == "feature":
            buckets["added"].append(body)
        elif typ == "fix":
            buckets["fixed"].append(body)
        elif typ == "perf":
            buckets["perf"].append(body)
        elif typ == "docs":
            buckets["docs"].append(body)
        elif typ in ("security", "sec"):
            buckets["security"].append(body)
        elif typ in ("remove", "delete", "deprecate"):
            buckets["removed"].append(body)
        elif typ in (
            "chore",
            "ci",
            "build",
            "refactor",
            "style",
            "test",
            "revert",
        ):
            buckets["changed"].append(body)
        else:
            buckets["changed"].append(body)

    # Dedupe while preserving order
    for key in buckets:
        seen: set[str] = set()
        out: list[str] = []
        for item in buckets[key]:
            if item not in seen:
                seen.add(item)
                out.append(item)
        buckets[key] = out
    return buckets


def write_entry(
    path: str,
    version: str,
    release_name: str,
    previous_tag: str | None,
) -> None:
    today = datetime.now(timezone.utc).date().isoformat()
    subjects = subject_lines(previous_tag)
    kind, emoji = release_kind(version)
    cats = categorize(subjects)

    lines: list[str] = [
        "",
        f"## [{version}] - {today}",
        "",
        f"### {emoji} {kind}",
    ]
    if release_name.strip():
        lines.extend(["", f"**Codename:** {release_name.strip()}", ""])
    else:
        lines.append("")

    sections: list[tuple[str, list[str]]] = [
        ("✨ Added", cats["added"]),
        ("🔧 Changed", cats["changed"]),
        ("🐛 Fixed", cats["fixed"]),
        ("🗑️ Removed", cats["removed"]),
        ("📚 Documentation", cats["docs"]),
        ("🛡️ Security", cats["security"]),
        ("🚀 Performance", cats["perf"]),
    ]

    any_items = any(items for _, items in sections)
    if not any_items:
        lines.extend(
            [
                "### 🔧 Changed",
                "- _(No commit subjects in range; see git history for this tag.)_",
                "",
            ]
        )
    else:
        for title, items in sections:
            if not items:
                continue
            lines.append(f"### {title}")
            for it in items:
                lines.append(f"- {it}")
            lines.append("")

    lines.append("---")
    lines.append("")

    text = "\n".join(lines)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def print_usage(exit_code: int = 0) -> None:
    msg = """\
Usage:
  python scripts/smart-changelog.py VERSION [RELEASE_NAME] [PREVIOUS_TAG]

Arguments:
  VERSION         Git tag to document, e.g. v0.2.0
  RELEASE_NAME    Optional codename; use "" if none (PowerShell: two double-quotes)
  PREVIOUS_TAG    Lower bound for git log (e.g. v0.1.0), or omit / use none for recent history

Examples:
  python scripts/smart-changelog.py v0.2.0
  python scripts/smart-changelog.py v0.2.0 "" v0.1.0

Full release (bump versions, tag, update CHANGELOG.md) — use the shell helper, not this script:
  ./release.sh --minor
  ./release.sh --patch

This script only writes smart-changelog-<VERSION>.md (used by release.sh when present).
"""
    print(msg, file=sys.stderr if exit_code else sys.stdout)
    raise SystemExit(exit_code)


def main() -> int:
    if len(sys.argv) < 2:
        print_usage(1)
    arg1 = sys.argv[1]
    if arg1 in ("-h", "--help"):
        print_usage(0)

    version = arg1
    if not VERSION_ARG.match(version):
        print(
            f"error: invalid VERSION {version!r} - expected a tag like v0.2.0.\n"
            f"       --minor / --patch are flags for release.sh, not this script.\n",
            file=sys.stderr,
        )
        print(
            "       Try:  python scripts/smart-changelog.py v0.2.0 \"\" v0.1.0\n"
            "   or full release:  bash release.sh --minor\n",
            file=sys.stderr,
        )
        return 1

    release_name = sys.argv[2] if len(sys.argv) > 2 else ""
    prev = sys.argv[3] if len(sys.argv) > 3 else "none"
    prev_tag: str | None = prev if prev and prev.lower() != "none" else None

    out = f"smart-changelog-{version}.md"
    try:
        write_entry(out, version, release_name, prev_tag)
    except OSError as e:
        print(f"Error writing {out}: {e}", file=sys.stderr)
        return 1
    print(f"Wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
