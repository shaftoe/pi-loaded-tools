# Refactoring Plan for pi-loaded-tools

## ✅ All items applied

| #   | Item                                               | Status                                                 |
| --- | -------------------------------------------------- | ------------------------------------------------------ |
| 1   | Remove `--interactive` vaporware from docs         | ✅ Done                                                |
| 2   | Remove `ToolScope` & `ToolOrigin` unused types     | ✅ Done                                                |
| 3   | DRY: Accept `LoadedTool[]` in groups/stats         | ✅ Done                                                |
| 4   | DRY: Extract `toSourceGroup()` helper              | ✅ Done                                                |
| 5   | Untrack `coverage/` from git                       | ✅ Done                                                |
| 6   | Remove `.prettierignore` (duplicates `.gitignore`) | ✅ Done                                                |
| 7   | Unused dependencies audit                          | ✅ Audited — all needed                                |
| 8   | Un-export `showTools` from public API              | ✅ Done                                                |
| 9   | Move truncation to display layer                   | ✅ Done (`truncateDescription`)                        |
| 10  | Flatten file structure                             | ✅ Done (removed `list/` dir, renamed to `display.ts`) |

## Changes Summary

### File structure (before → after)

```
src/tools/list/index.ts  →  src/tools/display.ts   (internal, not re-exported)
src/tools/api.ts         →  src/tools/api.ts        (simplified)
src/tools/types.ts       →  src/tools/types.ts      (removed ToolScope, ToolOrigin)
src/tools/index.ts       →  src/tools/index.ts      (removed showTools, ToolScope, ToolOrigin exports)
src/index.ts             →  src/index.ts             (updated import path)
```

### Removed

- `ToolScope`, `ToolOrigin` types and `scope`/`origin` fields from `LoadedTool`
- `showTools` from public API barrel
- `.prettierignore` (redundant with `.gitignore`)
- `coverage/` from git tracking
- `--interactive` claims from README and AGENTS.md
- `list/` directory in favor of flat `display.ts`

### Added

- `truncateDescription()` — display-layer truncation (exported as utility)
- `toSourceGroup()` — shared helper eliminating source-mapping duplication
- `getToolGroups(LoadedTool[])` / `getToolStats(LoadedTool[])` — accept pre-computed arrays

### Test results

- 37 pass, 0 fail (up from 35, added `truncateDescription` tests)
- Build passes (`tsc --noEmit` + `tsconfig.build.json`)
