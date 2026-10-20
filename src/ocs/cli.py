"""User-facing experimental OCS command line."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import OCSError, get_graph, load_package, make_lock, validate_package, validate_schema


def pretty(value: object) -> str:
    return json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ocs", description="Open Course Standard reference tools (experimental v0.1)")
    sub = parser.add_subparsers(dest="command", required=True)
    for command in ("validate", "inspect", "graph", "lock", "verify"):
        p = sub.add_parser(command)
        p.add_argument("path", nargs="?", default=".", help="OCS package root (default: current directory)")
        if command == "lock":
            p.add_argument("--check", action="store_true", help="Compare against committed lock without writing it")
    args = parser.parse_args(argv)
    root = Path(args.path).resolve()
    try:
        if args.command == "validate":
            issues = validate_package(root)
            for issue in issues:
                print(f"FAIL {issue.code}: {issue.file}: {issue.message}")
            if issues:
                return 1
            print(f"PASS {root}: OCS package valid (local profile)")
            return 0
        if args.command == "inspect":
            p = load_package(root)
            print(pretty({"id": p["id"], "version": p["version"], "kind": p["kind"],
                          "title": p["metadata"]["title"], "resources": p.get("resources", []),
                          "composition": p.get("composition")} ), end="")
            return 0
        if args.command == "graph":
            print(pretty(get_graph(root)), end="")
            return 0
        lock_file = root / ".ocs" / "lock.json"
        computed = make_lock(root)
        if args.command == "lock" and not args.check:
            lock_file.parent.mkdir(parents=True, exist_ok=True)
            lock_file.write_text(pretty(computed), encoding="utf-8")
            print(f"WROTE {lock_file}")
            return 0
        if not lock_file.is_file():
            raise OCSError(f"Missing lockfile: {lock_file}. Run 'ocs lock' first")
        actual = json.loads(lock_file.read_text(encoding="utf-8"))
        schema_errors = validate_schema(actual, "lock")
        if schema_errors:
            raise OCSError("Invalid lockfile: " + "; ".join(schema_errors))
        if actual != computed:
            raise OCSError("Lock mismatch: dependencies, source files or release metadata changed; revalidate and run 'ocs lock'")
        print(f"PASS {lock_file}: locked local package snapshot verified")
        return 0
    except (OCSError, OSError, ValueError) as e:
        print(f"ERROR {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
