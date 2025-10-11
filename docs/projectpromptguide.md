The ATLAS Directive — Project Prompt Guide for AI Agents
Master directive to ensure quality, correctness, and consistency on all AI-generated code and content.

1. Truthfulness & Data Integrity
All content must reflect verifiable science about 3I/ATLAS from the project’s knowledge base and authenticated astrophysical data sources.

No made-up facts, filler, placeholders, or unverifiable statements.

Numeric and boolean fields must be calculated or logically derived based on current state or rules—never hardcoded unless static by design (e.g., fixed animation keys).

Narrative, skills, choices, and token mechanics must be internally consistent and factually accurate.

2. Code, Schema, and Linting Compliance
For TypeScript: Output must compile cleanly with no errors or warnings against the project’s tsconfig and ESLint configs.

For JSON/data: Output must strictly validate against the project JSON schema (e.g., node properties, choice structure, grants, requires, tokens).

Use safe markdown rendering only; no raw HTML or unsafe injection in any narrative text.

Follow existing naming conventions and file formatting precisely (uppercase file names, camelCase keys, etc.).

3. No Placeholder or Hardcoded Values Unless Explicitly Allowed
If a value is dynamic (token counts, grants, costs), it must be logically calculated per story context or token rules.

Explicitly reject or flag if forced to guess or “fill in” unknowns—request further instructions instead.

Achievements and token rules should reflect real interactions, not static, one-off values.

4. Output Format and Direct File Edits
AI agents have write access, so:

Outputs must be fully ready-to-integrate edits, patches, or new files in the repo.

No interim copy-paste or manual transfer steps.

All edits must be committed atomically with clear, descriptive commit messages.

All code and content changes must be executed only after passing local validator and linting/type checking scripts with zero errors.

5. Parallel Work and Conflict Avoidance
AI agents must coordinate via assigned file scopes and task ownership.

Concurrent edits permitted only when touching distinct files or clearly disjoint parts of data.

Narrative JSON patches must be serialized or gated with merge checks to avoid conflicts.

6. Validation & Testing
All content delivered must pass:

npm run narrative:validate with no errors or warnings, including meta-node count parity and reachability.

npm run lint and npm run type-check with zero issues.

Validator output logs should be stored and referenced for incremental improvements.

7. Creative and Narrative Consistency Checks
The narrative flow should reflect the 3I/ATLAS project’s chronology and scientific discoveries.

AI must highlight and flag any potential story inconsistencies or abrupt transitions for human creative review.

Markdown content clarity and engagement are key; keep passages concise and educational.

8. Reporting and Incremental Progress
Each chunk’s final commit must be accompanied by a short structured report summarizing:

Nodes added/fixed

Known open issues/gaps remaining (if any)

Validation compliance status

Token economy balance for the chunk

Use these for ongoing planning and adjustments.

End of Project Prompt Guide
