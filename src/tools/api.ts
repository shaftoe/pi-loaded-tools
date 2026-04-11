/**
 * API for querying and organizing loaded tools.
 */

import type { ToolInfo } from "@mariozechner/pi-coding-agent";
import type { LoadedTool, ToolGroups, ToolSource, ToolStats } from "./types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a ToolSource to its group key in ToolGroups / ToolStats. */
type SourceGroup = "builtin" | "sdk" | "extensions";

function toSourceGroup(source: ToolSource): SourceGroup {
  return source === "extension" ? "extensions" : source;
}

// ---------------------------------------------------------------------------
// Core: getAllLoadedTools
// ---------------------------------------------------------------------------

/**
 * Get all loaded tools with full metadata.
 *
 * @param allTools - Result of pi.getAllTools()
 * @param activeNames - Set of active tool names (pi.getActiveTools())
 * @returns Array of loaded tools with metadata
 */
export function getAllLoadedTools(allTools: ToolInfo[], activeNames: Set<string>): LoadedTool[] {
  return allTools.map((tool) => {
    const si = tool.sourceInfo;
    const rawSource = si?.source ?? "";
    const isBuiltin = (si?.path?.startsWith("<") ?? false) || rawSource === "builtin";
    const source: ToolSource = isBuiltin ? "builtin" : rawSource === "sdk" ? "sdk" : "extension";

    // Derive a human-readable extension name:
    // - npm packages: sourceInfo.source is the package identifier (e.g. "npm:@foo/bar")
    // - local extensions: sourceInfo.path is the file path
    // - built-in/SDK: not needed
    let extensionPath: string | undefined;
    if (source === "extension") {
      const origin = si?.origin ?? "top-level";
      if (origin === "package" && rawSource && rawSource !== "local") {
        extensionPath = rawSource;
      } else {
        extensionPath = si?.path || undefined;
      }
    }

    // Take only first line of description, no truncation (that's a display concern)
    const desc = (tool.description ?? "").split("\n")[0] ?? "";

    return {
      name: tool.name,
      description: desc.trim(),
      active: activeNames.has(tool.name),
      source,
      scope: (si?.scope as LoadedTool["scope"]) ?? "project",
      origin: (si?.origin as LoadedTool["origin"]) ?? undefined,
      extensionPath,
    };
  });
}

// ---------------------------------------------------------------------------
// Derived queries (accept pre-computed LoadedTool[])
// ---------------------------------------------------------------------------

/**
 * Get tools grouped by source and active status.
 *
 * @param tools - Pre-computed array from getAllLoadedTools()
 * @returns Tools organized by source and active status
 */
export function getToolGroups(tools: LoadedTool[]): ToolGroups {
  const groups: ToolGroups = {
    builtin: { active: [], inactive: [] },
    sdk: { active: [], inactive: [] },
    extensions: { active: [], inactive: [] },
  };

  for (const tool of tools) {
    const target = groups[toSourceGroup(tool.source)];
    (tool.active ? target.active : target.inactive).push(tool);
  }

  return groups;
}

/**
 * Get statistics about loaded tools.
 *
 * @param tools - Pre-computed array from getAllLoadedTools()
 * @returns Tool statistics
 */
export function getToolStats(tools: LoadedTool[]): ToolStats {
  const stats: ToolStats = {
    total: tools.length,
    active: 0,
    inactive: 0,
    builtin: { total: 0, active: 0 },
    sdk: { total: 0, active: 0 },
    extensions: { total: 0, active: 0 },
  };

  for (const tool of tools) {
    stats.active += tool.active ? 1 : 0;
    stats.inactive += tool.active ? 0 : 1;

    const target = stats[toSourceGroup(tool.source)];
    target.total++;
    if (tool.active) {
      target.active++;
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Maximum description length for display. */
const MAX_DESC_LEN = 120;
const ELLIPSIS = "...";

/**
 * Truncate a description string for display.
 */
export function truncateDescription(desc: string): string {
  if (desc.length <= MAX_DESC_LEN) return desc;
  return `${desc.slice(0, MAX_DESC_LEN - ELLIPSIS.length)}${ELLIPSIS}`;
}

/**
 * Format tool source for display.
 *
 * @param source - Tool source (already mapped from Pi's raw values)
 * @param extensionPath - Extension identifier (package name or file path)
 * @returns Formatted source string
 */
export function formatToolSource(source: ToolSource, extensionPath?: string): string {
  if (source === "builtin") return "built-in";
  if (source === "sdk") return "SDK";
  if (source === "extension" && extensionPath) {
    return extensionPath.replace(/\/dist\/index\.js$/, "") || extensionPath;
  }
  return "extension";
}

/**
 * Get a display label for a tool source.
 *
 * @param source - Tool source
 * @returns Display label (e.g., "Built-in", "SDK", "Extensions")
 */
export function getSourceLabel(source: ToolSource): string {
  switch (source) {
    case "builtin":
      return "Built-in";
    case "sdk":
      return "SDK";
    case "extension":
      return "Extensions";
  }
}
