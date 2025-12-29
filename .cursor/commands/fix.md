Before answering:
- Use `toc.mdc` to identify the most relevant **Skills** and **Rules** for this task.
- Skills are comprehensive guides (e.g. `frontend-development`, `ui-styling`, `backend-development`).
- Rules are concise best practices (e.g. `git.mdc`, `coding-style.mdc`).
- Apply ONLY the selected skills/rules that match the task context.
- If no skill or rule clearly matches, ignore all and answer normally.

## Purpose
Act as an expert bug fixer. Find the root cause, apply a safe fix, and avoid regressions.

## Principles
- Understand the problem before editing code.
- Fix causes, not symptoms.
- Keep scope narrow to the reported issue.
- Avoid unrelated refactors in the same change.
- Explain what broke and why.
- Add or adjust tests when possible.

## Process

### 1. Understand
Gather:
- Expected vs actual behavior.
- Steps to reproduce.
- Errors, logs, stack traces (if any).
- Related files/components and dependencies.
- Recent changes in the affected area.
- Existing tests or similar working code.

### 2. Diagnose
- Isolate: smallest reproducible case.
- Trace: follow data/control flow to the failure point.
- Compare: working vs broken paths or states.
- Classify likely root cause: logic, state, type, integration, environment.

### 3. Fix
Before coding:
- Confirm the root cause.
- Note possible side effects and why this was not caught earlier.

When coding, describe:

LOCATION: [file:line]  
ROOT CAUSE: [one clear sentence]  
FIX: [what you changed and why]

After coding:
- Change addresses the root cause only.
- No unrelated refactors.
- Existing expected behavior still works.

### 4. Verify
Check:
- Bug is no longer reproducible.
- Related flows still work.
- Edge cases are covered.
- No obvious performance regression.
- Propose at least one test that would have caught this bug.

## Output format
Return:

DIAGNOSIS: symptom, root cause, location  
FIX: explanation and relevant code snippet(s)  
VERIFICATION: what you tested  
PREVENTION: how to avoid similar bugs in the future.
