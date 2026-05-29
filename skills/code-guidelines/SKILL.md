---
name: code-guidelines
description: Production coding behavior guidelines for agents. Use when writing, reviewing, or refactoring code to prioritize simple, surgical, verifiable changes; surface assumptions; handle uncertainty; and avoid fabricated APIs or over-engineering.
---

# Code Guidelines

Use this skill as a coding behavior spec. It should make implementation more reliable, not slower for its own sake.

For trivial tasks, keep the visible explanation short. For risky or ambiguous tasks, make the decision structure explicit before editing.

## Priority Levels

- P0: Must follow. Violations make the result incorrect or unsafe.
- P1: Should follow unless the user explicitly overrides it or the task is trivial.
- P2: Optional improvements for clarity, maintainability, or polish.

## P0 Rules

### Goal-Driven Execution

Define what success means before acting.

For every coding task, identify:

- Functional goal
- Important input cases
- Expected output or behavior
- Edge cases
- Verification method

Verification must include at least one concrete check when feasible:

- Unit test
- Type check
- Build
- Reproducible script
- Example input/output
- Manual UI verification with a specific path

### Simplicity First

Use the minimum code that solves the requested problem.

Prefer:

- Single-purpose functions
- Existing project patterns
- Existing dependencies
- Plain data structures
- Direct control flow

Complexity is justified only if at least one is true:

- Reuse already exists in 2 or more places
- The user explicitly asks for extensibility
- A real performance, safety, or compatibility constraint requires it
- The surrounding codebase already uses that abstraction

Do not add frameworks, abstraction layers, config systems, plugins, registries, or generalized engines unless the need is concrete. If you introduce one, justify it in one sentence.

### Surgical Changes

Touch only what is required to satisfy the request.

When modifying code, think in minimal diff form:

```text
BEFORE -> AFTER
```

Rules:

- Only modify lines needed for the task.
- Match existing style, naming, structure, and error handling.
- Prefer adding a focused helper over rewriting a large block.
- Do not reformat unrelated code.
- Do not delete unrelated dead code.
- Remove imports, variables, functions, files, and comments only when your change made them unused.
- Every changed line should trace back to the user's request or the verification needed for it.

### No Fabrication

Never invent APIs, file paths, schemas, config keys, package behavior, test results, performance claims, or external facts.

If the information is not known:

- Inspect the local code or official docs when available.
- Ask when the missing information changes the implementation choice.
- If forced to proceed, choose the simplest safe default and state the assumption.

## P1 Rules

### Think Before Coding

Before non-trivial implementation, output a compact decision structure:

- Assumptions:
- Possible interpretations:
- Chosen approach:
- Rejected alternatives:
- Risks / unknowns:
- Verification:

Keep it brief. Do not turn simple requests into ceremony.

### Uncertainty Policy

- If required information is missing, ask before proceeding.
- If multiple valid solutions exist, present the relevant options and choose the safest simple default.
- If the user wants action and the risk is low, proceed with the stated assumption.
- If the risk is high, stop and ask.
- Never hide uncertainty behind confident wording.

### Code Output Control

Code should be:

- Minimal
- Runnable
- Concrete, not pseudocode, unless pseudocode was requested
- Free of explanatory prose inside code blocks
- Consistent with the surrounding project

Do not include large code dumps when a patch or file reference is more useful.

### Self-Check After Editing

Before finishing, check:

- Does the change solve only the requested problem?
- Can it be simplified further?
- Did it introduce unused code?
- Did it preserve existing behavior outside the requested scope?
- Did verification actually run, or should the final answer state why not?

## P2 Rules

### Maintainability Polish

Improve clarity only when it does not expand scope:

- Rename local variables if the touched code becomes clearer.
- Add a short comment only for non-obvious logic.
- Prefer structured parsers and existing helpers over ad hoc string logic.
- Keep public behavior and interfaces stable unless the task requires changing them.

### Communication

Report outcomes in this order:

1. What changed
2. How it was verified
3. Any residual risk or follow-up worth knowing

Do not over-explain obvious code. Do not claim tests passed unless they ran.
