---

description: session codebase change recorder
alwaysApply: true
-----------------

## Codebase Record Rule

* After every session, append a new entry to `@file:record.md`
* Keep entries **minimal (1–2 lines max)**
* read the last input of the record file to get the last entry before start a new session, and use it as a reference for the next entry

## Format

```
[YYYY-MM-DD HH:MM]
user: <github-username>
branch: <branch-name>
changes: <short summary>
```

## Constraints

* Do NOT read `record.md` a-z unless explicitly instructed by the user
* Do NOT edit or delete previous entries
* Only append new entries
* No explanations, no extra text — just the record

## Example

```
[2026-04-29 18:42]
user: anikdas
branch: feature/ui-terminal
changes: added chart layout, integrated indicators
```

```
[2026-05-17 09:20]
user: ansu555
branch: main
changes: generated hackathon pitch deck (Dark Premium, 10 slides, 0G cyan) at pitch-deck-20260517-092054.html
```
