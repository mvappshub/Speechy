---
name: pragmatic-superpowers
description: Decide when to use heavyweight process skills in this repository and when to skip them. Optimized for a non-programmer operator who wants strong guardrails without turning every exchange into ceremony.
license: MIT
---

# Pragmatic Superpowers For This Repo

This skill is a local policy layer for using global superpowers skills selectively instead of automatically.

Its job is simple:
- keep the safety benefits
- avoid workflow overhead on trivial requests
- reduce hallucinated assumptions and code-smell churn

## Default Stance

Do normal, direct work by default.

Do not escalate into heavyweight workflow just because a skill exists.

Skip heavy process skills for:
- greetings and casual chat
- simple factual questions
- summarization or translation
- obvious one-step edits
- tiny copy or styling tweaks
- straightforward commands with clear expected output

## When To Use Brainstorming

Use `brainstorming` only for design-heavy or ambiguity-heavy work:
- net-new features
- UX or workflow changes
- architecture decisions
- requests with multiple valid implementations and different tradeoffs
- moments when the user is still figuring out what they want

Do not use it for clearly specified fixes.

## When To Use Systematic Debugging

Use `systematic-debugging` when there is an actual failure signal:
- a test fails
- the app crashes
- the build fails
- an integration behaves unexpectedly
- the bug cause is not already obvious

Use a light version for obvious issues:
- read the error
- confirm the failing location
- make the narrow fix
- verify

## When To Use TDD

Use `test-driven-development` for behavior changes and bug fixes when tests are practical and valuable.

Strongest candidates in this repo:
- reader domain or application logic
- parsing, transformation, or chunking logic
- backend request/response behavior
- regressions that should never return

Usually skip strict TDD for:
- docs
- copy
- CSS-only styling
- config-only edits
- non-behavioral cleanup

## Always Keep This Guardrail

Before claiming success after code changes, use the spirit of `verification-before-completion`:
- run the relevant command now
- read the result
- state exactly what was and was not verified

## Recommended Decision Rule

Choose the lightest workflow that still protects quality:

1. No failure, no ambiguity, no new behavior:
Direct execution.

2. Ambiguous feature or workflow:
Brainstorm briefly, then implement.

3. Bug or failure:
Debug first.

4. Bug fix or behavior change with testable logic:
Debug, then TDD the regression when practical.

5. Any code change before claiming done:
Verify with evidence.
