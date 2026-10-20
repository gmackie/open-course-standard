# Contributing to OCS

OCS is an **experimental standards project**, not yet a settled standard. Propose changes as issues or pull requests and state which conformance profile and RFC they affect.

For a normative RFC change:

1. State the problem and at least one real educational example (middle-school, high-school, postsecondary, research, or self-directed).
2. Define producer, consumer, or runtime responsibility. Use BCP 14 **MUST/SHOULD/MAY** only for testable requirements.
3. Add or update schema fixtures and conformance tests for required behavior.
4. Include backward-compatibility, disclosure, privacy, and license implications.
5. Explain the relationship to Git, existing IETF/W3C/1EdTech standards, and prior RFCs.

RFC status transitions are described in [GOVERNANCE.md](GOVERNANCE.md). A draft's approval in Git does not imply broad consensus or official external standards-body recognition.

Run:

```sh
python -m pip install -e .
python -m unittest discover -s tests -v
ocs validate examples/minimal-course
ocs verify examples/federated-watershed
```

Please avoid real student data, exam secrets, private access tokens, or copyrighted textbooks in fixtures. All example identities are illustrative.
