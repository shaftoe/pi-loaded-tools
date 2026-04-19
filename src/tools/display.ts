/**
 * Tools display logic — formats and shows loaded tools using Pi's native
 * boot-time visual style (same theme tokens, scope grouping, indentation).
 *
 * Supports compact (collapsed) and expanded views, toggled by ctrl+o.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { getAllLoadedTools } from "./api.js";
import type { LoadedTool } from "./types.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface ToolEntry {
  name: string;
  active: boolean;
}

interface ScopeGroup {
  scope: string;
  localTools: ToolEntry[];
  packages: Map<string, ToolEntry[]>;
}

function buildToolGroups(tools: LoadedTool[]): ScopeGroup[] {
  const builtin: ScopeGroup = { scope: "builtin", localTools: [], packages: new Map() };
  const project: ScopeGroup = { scope: "project", localTools: [], packages: new Map() };
  const user: ScopeGroup = { scope: "user", localTools: [], packages: new Map() };
  const path: ScopeGroup = { scope: "path", localTools: [], packages: new Map() };

  for (const tool of tools) {
    let group: ScopeGroup;

    if (tool.source === "builtin") {
      group = builtin;
    } else if (tool.source === "sdk") {
      group = path;
    } else {
      const scope = tool.scope;
      group = scope === "user" ? user : scope === "project" ? project : path;
    }

    const isPackage = tool.origin === "package" && tool.extensionPath;
    if (isPackage) {
      const list = group.packages.get(tool.extensionPath!) ?? [];
      list.push({ name: tool.name, active: tool.active });
      group.packages.set(tool.extensionPath!, list);
    } else {
      group.localTools.push({ name: tool.name, active: tool.active });
    }
  }

  return [builtin, project, user, path].filter(
    (g) => g.localTools.length > 0 || g.packages.size > 0
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the one-line stats summary shown in expanded mode.
 */
function buildStatsLine(tools: LoadedTool[]): string {
  const total = tools.length;
  const active = tools.filter((t) => t.active).length;
  const extCount = tools.filter((t) => t.source === "extension").length;
  const parts = [`${total} tool${total !== 1 ? "s" : ""}`, `${active} active`];
  if (extCount > 0) {
    parts.push(`${extCount} from extension${extCount !== 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

/**
 * Format a loaded-tools list using Pi's native boot-time visual style.
 *
 * When `compact` is true, shows a single line listing tool names
 * (matching Pi's default boot layout for skills/extensions). When false
 * (the default / expanded), shows the full listing with scope groups,
 * active indicators, and a stats summary line.
 *
 * Compact output:
 * ```
 * [Tools] bash, read, write, edit
 * ```
 *
 * Expanded output:
 * ```
 * [Tools]
 *   builtin
 *     ● bash
 *     ● read
 *   project
 *     ● my_local_tool
 *   user
 *     npm:@scope/package
 *       ● ext_tool
 *   14 tools · 13 active · 1 from extensions
 * ```
 */
export function formatToolsList(tools: LoadedTool[], theme: Theme, compact = false): string {
  if (compact) {
    const names = tools.map((t) => t.name).sort((a, b) => a.localeCompare(b));
    const body = names.length > 0 ? theme.fg("dim", names.join(", ")) : theme.fg("dim", "(none)");
    return theme.fg("mdHeading", "\x1b[1m[Tools]\x1b[22m") + " " + body;
  }

  const stats = buildStatsLine(tools);
  const lines: string[] = [];
  lines.push(theme.fg("mdHeading", "[Tools]"));

  const groups = buildToolGroups(tools);

  for (const group of groups) {
    lines.push(`  ${theme.fg("accent", group.scope)}`);

    const sorted = [...group.localTools].sort((a, b) => a.name.localeCompare(b.name));
    for (const tool of sorted) {
      lines.push(theme.fg("dim", `    ${tool.active ? "●" : "○"} ${tool.name}`));
    }

    const sortedPkgs = Array.from(group.packages.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [source, pkgTools] of sortedPkgs) {
      lines.push(`    ${theme.fg("mdLink", source)}`);
      const sortedPkgTools = [...pkgTools].sort((a, b) => a.name.localeCompare(b.name));
      for (const tool of sortedPkgTools) {
        lines.push(theme.fg("dim", `      ${tool.active ? "●" : "○"} ${tool.name}`));
      }
    }
  }

  lines.push(theme.fg("dim", `  ${stats}`));

  return lines.join("\n");
}

/**
 * Show loaded tools as a persistent chat message.
 *
 * Uses `pi.sendMessage()` so the tools list appears inline in the chat
 * (same visual position as Pi's native `[Skills]`, `[Extensions]`, etc.)
 * and survives theme changes via the registered message renderer.
 */
export function showTools(pi: ExtensionAPI, _ctx: ExtensionContext): void {
  const tools = getAllLoadedTools(pi.getAllTools(), new Set(pi.getActiveTools()));
  pi.sendMessage({
    customType: "pi-loaded-tools",
    content: `${tools.length} tools (${tools.filter((t) => t.active).length} active)`,
    display: true,
    details: { tools },
  });
}
