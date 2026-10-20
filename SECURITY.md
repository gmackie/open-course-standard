# Security model (draft)

Treat every external OCS package, Git dependency, educational file, agent instruction, and model-generated artifact as untrusted until explicitly authorized. **Importing content is not permission to execute it.**

Never publish exam solutions or other restricted content into a student-readable Git history: branches, tags, sparse checkout, and frontend visibility cannot provide confidentiality. Deliver learners from separately materialized authorized snapshots or protected resource APIs. Avoid copying personally identifiable student records into shared repositories.

The reference CLI reads local files and **does not execute package scripts, import arbitrary plugins, fetch untrusted remotes, or authenticate to LMSs**. It rejects unsafe local resource paths and YAML aliases/custom tags. This is an experimental validator, not a complete security boundary; run it on untrusted directories with ordinary OS-level protections and without elevated privileges.

To report a vulnerability, use GitHub's private vulnerability reporting feature if enabled, or contact repository maintainers through an appropriate private channel rather than opening a public exploit report with sensitive data.
