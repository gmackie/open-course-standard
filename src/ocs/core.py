"""Minimal, non-executing reference parser, validator and local lock resolver.

This is an experimental v0.1 implementation, *not* the normative implementation
of any remote Git, registry, identity, signing, disclosure or LTI profile.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from importlib.resources import files
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator


class OCSError(Exception):
    """User-visible OCS validation/resolution error."""


class StrictLoader(yaml.SafeLoader):
    """Safe YAML loader with duplicate-key and alias/anchor restrictions.

    PyYAML defaults to YAML 1.1's surprising bool and timestamp coercions.
    This constrained profile uses JSON-compatible YAML values instead.
    """

    def compose_node(self, parent: Any, index: Any) -> Any:
        if self.check_event(yaml.AliasEvent):
            raise OCSError("YAML aliases are not permitted")
        node = super().compose_node(parent, index)
        if getattr(node, "anchor", None) or getattr(node, "tag", "").startswith("!"):
            raise OCSError("YAML anchors and custom tags are not permitted")
        return node

    def compose_scalar_node(self, anchor: str | None) -> Any:
        if anchor:
            raise OCSError("YAML anchors are not permitted")
        return super().compose_scalar_node(anchor)

    def compose_sequence_node(self, anchor: str | None) -> Any:
        if anchor:
            raise OCSError("YAML anchors are not permitted")
        return super().compose_sequence_node(anchor)

    def compose_mapping_node(self, anchor: str | None) -> Any:
        if anchor:
            raise OCSError("YAML anchors are not permitted")
        return super().compose_mapping_node(anchor)

    def construct_mapping(self, node: yaml.MappingNode, deep: bool = False) -> dict:
        if not isinstance(node, yaml.MappingNode):
            raise OCSError("Expected YAML mapping")
        result: dict[str, Any] = {}
        for key_node, value_node in node.value:
            key = self.construct_object(key_node, deep=deep)
            if not isinstance(key, str):
                raise OCSError("YAML mapping keys MUST be strings")
            if key in result:
                raise OCSError(f"Duplicate YAML mapping key: {key!r}")
            result[key] = self.construct_object(value_node, deep=deep)
        return result


StrictLoader.yaml_implicit_resolvers = {
    first: [(tag, rx) for tag, rx in resolvers
            if tag not in ("tag:yaml.org,2002:bool", "tag:yaml.org,2002:timestamp")]
    for first, resolvers in StrictLoader.yaml_implicit_resolvers.items()
}
StrictLoader.add_implicit_resolver(
    "tag:yaml.org,2002:bool", re.compile(r"^(?:true|false)$", re.IGNORECASE), list("tTfF")
)


def _ensure_json_compatible(value: Any, location: str = "$") -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise OCSError(f"Non-finite number not permitted at {location}")
        return
    if isinstance(value, list):
        for i, entry in enumerate(value):
            _ensure_json_compatible(entry, f"{location}[{i}]")
        return
    if isinstance(value, dict):
        for k, entry in value.items():
            if not isinstance(k, str):
                raise OCSError(f"Non-string key at {location}")
            _ensure_json_compatible(entry, f"{location}.{k}")
        return
    raise OCSError(f"Non-JSON YAML type at {location}: {type(value).__name__}")


def read_document(path: Path) -> dict[str, Any]:
    try:
        text = path.read_text(encoding="utf-8")
        result = yaml.load(text, Loader=StrictLoader)
        if not isinstance(result, dict):
            raise OCSError("YAML document MUST be a mapping")
        _ensure_json_compatible(result)
        return result
    except (UnicodeError, OSError, yaml.YAMLError) as exc:
        raise OCSError(f"Could not read {path}: {exc}") from exc


def safe_path(root: Path, raw: str, *, expect_file: bool | None = None) -> Path:
    """Resolve a package-relative path; refuse traversal, symlink escapes and absolutes."""
    if not isinstance(raw, str) or not raw or "\\" in raw or "\x00" in raw:
        raise OCSError(f"Invalid package-relative path: {raw!r}")
    path_parts = Path(raw).parts
    if Path(raw).is_absolute() or ".." in path_parts:
        raise OCSError(f"Unsafe path (absolute/traversal): {raw!r}")
    base = root.resolve()
    path = (base / raw).resolve()
    if not path.is_relative_to(base):
        raise OCSError(f"Unsafe path (outside package): {raw!r}")
    if not path.exists():
        raise OCSError(f"Missing file or directory: {raw!r}")
    if expect_file is True and not path.is_file():
        raise OCSError(f"Expected file: {raw!r}")
    if expect_file is False and not path.is_dir():
        raise OCSError(f"Expected directory: {raw!r}")
    return path


def validate_schema(value: dict, name: str) -> list[str]:
    schema_path = files("ocs").joinpath("schemas", "v0.1", f"{name}.schema.json")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(value), key=lambda err: (tuple(str(p) for p in err.path), err.message))
    return [f"{'.'.join(str(p) for p in e.path) or '$'}: {e.message}" for e in errors]


@dataclass(frozen=True)
class Diagnostic:
    code: str
    message: str
    file: str


def _schema_checks(obj: dict, schema_name: str, filename: str) -> list[Diagnostic]:
    return [Diagnostic("SCHEMA", error, filename) for error in validate_schema(obj, schema_name)]


def load_package(root: Path) -> dict:
    path = root.resolve() / "ocs.yaml"
    if not path.is_file():
        raise OCSError(f"Missing OCS root manifest: {path}")
    package = read_document(path)
    errors = validate_schema(package, "package")
    if errors:
        raise OCSError("Invalid ocs.yaml: " + "; ".join(errors))
    return package


def load_composition(root: Path, package: dict) -> dict | None:
    if "composition" not in package:
        return None
    path = safe_path(root, package["composition"], expect_file=True)
    doc = read_document(path)
    errors = validate_schema(doc, "composition")
    if errors:
        raise OCSError("Invalid composition: " + "; ".join(errors))
    return doc


def _check_resource(root: Path, entry: dict) -> list[Diagnostic]:
    path_name = entry["path"]
    try:
        path = safe_path(root, path_name, expect_file=True)
        if path.suffix.lower() in (".yaml", ".yml", ".json"):
            obj = json.loads(path.read_text("utf-8")) if path.suffix == ".json" else read_document(path)
            schema = "assessment" if entry["kind"] == "AssessmentBlueprint" else "resource"
            failures = _schema_checks(obj, schema, path_name)
            if failures:
                return failures
            if obj["id"] != entry["id"] or obj["kind"] != entry["kind"]:
                return [Diagnostic("RESOURCE_IDENTITY", "Declared id/kind differs from the resource descriptor", path_name)]
            if schema == "resource":
                for content_path in [*([obj.get("content", {}).get("primary")] if obj.get("content", {}).get("primary") else []),
                                     *obj.get("content", {}).get("supplemental", [])]:
                    safe_path(root, (path.parent.relative_to(root) / content_path).as_posix(), expect_file=True)
    except (OCSError, ValueError, OSError, KeyError) as e:
        return [Diagnostic("RESOURCE_PATH", str(e), path_name)]
    return []


def validate_package(root: Path, *, recursive: bool = True, _stack: tuple[Path, ...] = ()) -> list[Diagnostic]:
    root = root.resolve()
    if root in _stack:
        return [Diagnostic("DEPENDENCY_CYCLE", " -> ".join(str(p) for p in (*_stack, root)), str(root))]
    try:
        pkg = load_package(root)
    except OCSError as e:
        return [Diagnostic("PACKAGE", str(e), str(root / "ocs.yaml"))]

    errors: list[Diagnostic] = []
    entries = pkg.get("resources", [])
    known_resources = {r["id"] for r in entries}
    if len(known_resources) != len(entries):
        errors.append(Diagnostic("RESOURCE_DUPLICATE", "Duplicate resource id", "ocs.yaml"))
    for entry in entries:
        errors.extend(_check_resource(root, entry))
    for extension in pkg.get("extensions", []):
        if extension["required"]:
            errors.append(Diagnostic("UNSUPPORTED_EXTENSION", f"Required extension not implemented by v0.1 reference reader: {extension['id']}", "ocs.yaml"))
    for id_ in pkg.get("entrypoints", []):
        if id_ not in known_resources:
            errors.append(Diagnostic("ENTRYPOINT", f"Unknown resource: {id_}", "ocs.yaml"))
    try:
        composition = load_composition(root, pkg)
    except OCSError as e:
        errors.append(Diagnostic("COMPOSITION", str(e), "ocs.yaml"))
        return errors
    if composition is None:
        return errors

    imports = composition.get("imports", [])
    known_aliases = {i["alias"] for i in imports}
    if len(known_aliases) != len(imports):
        errors.append(Diagnostic("ALIAS_DUPLICATE", "Duplicate import alias", pkg["composition"]))
    local_packages: dict[str, dict] = {}
    for imp in imports:
        if imp["source"]["type"] not in ("local", "git-submodule"):
            continue  # external sources require a separate, networked resolution profile
        try:
            source = safe_path(root, imp["source"]["path"], expect_file=False)
            dep = load_package(source)
            if dep["id"] != imp["package"]:
                raise OCSError(f"Import {imp['alias']}: claimed package {imp['package']}, found {dep['id']}")
            if imp["version"] != dep["version"]:
                raise OCSError(f"Import {imp['alias']}: version {imp['version']} != declared {dep['version']} (v0.1 local profile requires exact versions)")
            local_packages[imp["alias"]] = dep
            if recursive:
                for d in validate_package(source, recursive=True, _stack=(*_stack, root)):
                    errors.append(Diagnostic(d.code, d.message, f"{imp['alias']}/{d.file}"))
        except OCSError as e:
            errors.append(Diagnostic("IMPORT", str(e), pkg["composition"]))
    placements = composition["placements"]
    placement_ids = {p["id"] for p in placements}
    if len(placement_ids) != len(placements):
        errors.append(Diagnostic("PLACEMENT_DUPLICATE", "Duplicate placement id", pkg["composition"]))
    for placement in placements:
        alias = placement["use"]["from"]
        resource = placement["use"]["resource"]
        if alias != "self" and alias not in known_aliases:
            errors.append(Diagnostic("PLACEMENT_ALIAS", f"Unknown alias {alias}", pkg["composition"]))
        if alias == "self" and resource not in known_resources:
            errors.append(Diagnostic("PLACEMENT_RESOURCE", f"Unknown local resource {resource}", pkg["composition"]))
        if alias in local_packages and resource not in {r["id"] for r in local_packages[alias].get("resources", [])}:
            errors.append(Diagnostic("PLACEMENT_RESOURCE", f"Unknown imported resource {alias}:{resource}", pkg["composition"]))
        for previous in placement.get("after", []):
            if previous not in placement_ids:
                errors.append(Diagnostic("PLACEMENT_AFTER", f"Unknown placement {previous}", pkg["composition"]))
    return errors


_EXCLUDED_DIRS = {".git", ".venv", "node_modules", "__pycache__", ".pytest_cache"}


def package_digest(root: Path) -> str:
    """Prototype digest: SHA-256 over canonical JSON of sorted raw file inventories.

    This is not the final normative OCS digest algorithm. It excludes the lock
    file to avoid a circular dependency. Files inside dependency mounts remain
    part of the parent local source tree.
    """
    root = root.resolve()
    entries: list[dict] = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if any(segment in _EXCLUDED_DIRS for segment in relative.parts):
            continue
        if relative.as_posix() == ".ocs/lock.json":
            continue
        if path.is_symlink():
            raise OCSError(f"Symlinks are not supported by prototype digest: {relative}")
        if not path.is_file():
            continue
        data = path.read_bytes()
        entries.append({"path": relative.as_posix(), "size": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    payload = json.dumps(entries, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + hashlib.sha256(payload).hexdigest()


def make_lock(root: Path) -> dict:
    root = root.resolve()
    failures = validate_package(root)
    if failures:
        raise OCSError("Cannot lock invalid package: " + "; ".join(f"{d.code}: {d.message}" for d in failures))
    pkg = load_package(root)
    deps: list[dict] = []

    def walk(path: Path, prefix: str, stack: tuple[Path, ...]):
        if path in stack:
            raise OCSError("Dependency cycle while locking: " + str(path))
        p = load_package(path)
        comp = load_composition(path, p)
        for imp in (comp or {}).get("imports", []):
            if imp["source"]["type"] != "local":
                raise OCSError("Prototype lock resolves only local imports; remote Git/submodules require the future Git profile")
            child = safe_path(path, imp["source"]["path"], expect_file=False)
            alias = f"{prefix}/{imp['alias']}" if prefix else imp["alias"]
            dep_pkg = load_package(child)
            deps.append({
                "alias": alias, "id": dep_pkg["id"], "version": dep_pkg["version"],
                "digest": package_digest(child),
                "source": {"type": "local", "path": child.relative_to(root).as_posix()},
            })
            walk(child, alias, (*stack, path))

    walk(root, "", ())
    lock = {"lockVersion": 1, "root": {"id": pkg["id"], "version": pkg["version"], "digest": package_digest(root)},
            "dependencies": sorted(deps, key=lambda dep: dep["alias"])}
    failures = validate_schema(lock, "lock")
    if failures:
        raise OCSError("Generated lock does not match schema: " + "; ".join(failures))
    return lock


def get_graph(root: Path) -> dict:
    pkg = load_package(root)
    comp = load_composition(root, pkg)
    nodes = [{"id": "self", "package": pkg["id"], "kind": "package"}]
    edges: list[dict] = []
    for imp in (comp or {}).get("imports", []):
        nodes.append({"id": imp["alias"], "package": imp["package"], "kind": "package"})
        edges.append({"from": "self", "to": imp["alias"], "type": "imports"})
    for placement in (comp or {}).get("placements", []):
        nodes.append({"id": placement["id"], "kind": "placement"})
        edges.append({"from": placement["use"]["from"], "to": placement["id"],
                      "type": "uses", "resource": placement["use"]["resource"]})
        for predecessor in placement.get("after", []):
            edges.append({"from": predecessor, "to": placement["id"], "type": "after"})
    return {"package": pkg["id"], "nodes": nodes, "edges": edges}
