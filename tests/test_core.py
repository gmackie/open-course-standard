"""Conformance-oriented tests for the v0.1 *local* reference profile."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from ocs.cli import main
from ocs.core import OCSError, load_package, make_lock, read_document, safe_path, validate_package, validate_schema

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "examples"


class TestOCS(unittest.TestCase):
    def test_all_diverse_courses_validate(self):
        for name in ("minimal-course", "secondary-biology", "undergraduate-lab", "graduate-seminar", "federated-watershed"):
            with self.subTest(course=name):
                self.assertEqual([], validate_package(EXAMPLES / name))

    def test_minimal_course_has_no_institutional_assumptions(self):
        pkg = load_package(EXAMPLES / "minimal-course")
        for prohibited_requirement in ("grades", "credits", "term", "institution", "assessment"):
            self.assertNotIn(prohibited_requirement, pkg)

    def test_composed_course_has_two_dependencies(self):
        lock = make_lock(EXAMPLES / "federated-watershed")
        self.assertEqual(2, len(lock["dependencies"]))
        self.assertEqual(["codex", "field"], [d["alias"] for d in lock["dependencies"]])
        self.assertEqual([], validate_schema(lock, "lock"))

    def test_immutable_lock_changes_with_content(self):
        with tempfile.TemporaryDirectory() as temp:
            # Small synthetic package to verify accidental changes are detected.
            root = Path(temp)
            (root / "ocs.yaml").write_text('specVersion: "0.1"\nkind: Course\nid: org.example/test\nversion: "1.0.0"\nmetadata: {title: Test}\nresources: [{id: note, kind: Lesson, path: note.md}]\n', encoding="utf-8")
            (root / "note.md").write_text("first", encoding="utf-8")
            original = make_lock(root)
            self.assertEqual(0, main(["lock", str(root)]))
            self.assertEqual(0, main(["verify", str(root)]))
            (root / "note.md").write_text("tampered", encoding="utf-8")
            self.assertNotEqual(original["root"]["digest"], make_lock(root)["root"]["digest"])
            self.assertEqual(1, main(["verify", str(root)]))

    def test_duplicate_yaml_keys_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / "ocs.yaml"
            file.write_text('id: one\nid: two\n', encoding="utf-8")
            with self.assertRaises(OCSError):
                read_document(file)

    def test_yaml_alias_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / "ocs.yaml"
            file.write_text('first: &data [one]\nsecond: *data\n', encoding="utf-8")
            with self.assertRaises(OCSError):
                read_document(file)

    def test_bare_yaml_anchor_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / "ocs.yaml"
            file.write_text('first: &data [one]\n', encoding="utf-8")
            with self.assertRaises(OCSError):
                read_document(file)

    def test_unknown_required_extension_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "ocs.yaml").write_text('specVersion: "0.1"\nkind: Course\nid: org.example/test\nversion: "1.0.0"\nmetadata: {title: Test}\nextensions: [{id: org.example/custom, version: "1.0.0", required: true}]\n', encoding="utf-8")
            self.assertTrue(any(d.code == "UNSUPPORTED_EXTENSION" for d in validate_package(root)))

    def test_yaml_json_scalars(self):
        with tempfile.TemporaryDirectory() as temp:
            file = Path(temp) / "ocs.yaml"
            file.write_text('flag: true\nword: no\nweird: 2027-08-25\n', encoding="utf-8")
            values = read_document(file)
            self.assertIs(values["flag"], True)
            self.assertEqual("no", values["word"])
            self.assertEqual("2027-08-25", values["weird"])

    def test_path_traversal_and_symlink_escapes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "root"
            root.mkdir()
            other = Path(temp) / "secret.txt"
            other.write_text("secret", encoding="utf-8")
            (root / "link.txt").symlink_to(other)
            with self.assertRaises(OCSError):
                safe_path(root, "../secret.txt")
            with self.assertRaises(OCSError):
                safe_path(root, "link.txt")

    def test_missing_resource_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "ocs.yaml").write_text('specVersion: "0.1"\nkind: Course\nid: org.example/test\nversion: "1.0.0"\nmetadata: {title: Test}\nresources: [{id: gone, kind: Lesson, path: gone.md}]\nentrypoints: [gone]\n', encoding="utf-8")
            self.assertTrue(any(d.code == "RESOURCE_PATH" for d in validate_package(root)))

    def test_unknown_entrypoint_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "ocs.yaml").write_text('specVersion: "0.1"\nkind: Course\nid: org.example/test\nversion: "1.0.0"\nmetadata: {title: Test}\nentrypoints: [not-here]\n', encoding="utf-8")
            self.assertTrue(any(d.code == "ENTRYPOINT" for d in validate_package(root)))

    def test_bad_release_schema_rejected(self):
        self.assertTrue(validate_schema({"lockVersion": 1, "root": {"id": "test", "version": "1.0.0", "digest": "oops"}, "dependencies": []}, "lock"))


if __name__ == "__main__":
    unittest.main()
