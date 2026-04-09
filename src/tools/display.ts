/**
 * Tools display logic (internal — not part of public API).
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { formatToolSource, getAllLoadedTools } from "./api.js";

/**
 * Show loaded tools via notification.
 */
export function showTools(pi: ExtensionAPI, ctx: ExtensionContext): void {
  const theme = ctx.ui.theme;
  const tools = getAllLoadedTools(pi.getAllTools(), new Set(pi.getActiveTools()));

  const lines: string[] = [];
  lines.push(theme.fg("accent", "[Tools]"));

  // Active tools
  const active = tools.filter((t) => t.active);
  for (const tool of active) {
    const sourceDisplay = formatToolSource(tool.source, tool.extensionPath);
    lines.push(`  ● ${tool.name}  [${sourceDisplay}]`);
  }

  // Inactive tools
  const inactive = tools.filter((t) => !t.active);
  for (const tool of inactive) {
    const sourceDisplay = formatToolSource(tool.source, tool.extensionPath);
    lines.push(`  ${theme.fg("dim", `○ ${tool.name}  [${sourceDisplay}]`)}`);
  }

  ctx.ui.notify(lines.join("\n"), "info");
}
