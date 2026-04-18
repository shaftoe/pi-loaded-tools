/**
 * Pi List Tools Extension
 *
 * Registers a /tools command and automatically shows loaded tools at startup.
 * Also exports a public API for querying loaded tools programmatically.
 *
 * The tools list is rendered using Pi's native boot-time visual style
 * ([SectionName] headers, scope grouping, accent/dim/mdLink theme tokens)
 * via a custom message renderer, so it blends in with [Skills], [Extensions],
 * [Themes], etc.
 *
 * Supports Pi's compact/expanded boot layout: the tools list starts collapsed
 * (showing only a summary line) and can be expanded with ctrl+o, matching the
 * behaviour of built-in boot sections.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  MessageRenderer,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { setShowToolsOnStartup, shouldShowToolsOnStartup } from "./settings.js";
import { formatToolsList, showTools, type LoadedTool } from "./tools";

export default function (pi: ExtensionAPI): void {
  pi.registerMessageRenderer<{ tools: LoadedTool[] }>("pi-loaded-tools", ((
    message: { details?: { tools: LoadedTool[] } },
    options: { expanded: boolean },
    theme: import("@mariozechner/pi-coding-agent").Theme
  ) => {
    const tools: LoadedTool[] = message.details?.tools ?? [];
    const compact = !options?.expanded;
    return new Text(formatToolsList(tools, theme, compact), 0, 0);
  }) as MessageRenderer<{ tools: LoadedTool[] }>);

  pi.registerCommand("tools", {
    description: "List loaded tools or toggle startup auto-print with /tools on|off",
    handler: async (args: string, ctx: ExtensionContext) => {
      const command = args.trim().toLowerCase();

      if (!command) {
        await Promise.resolve(showTools(pi, ctx));
        return;
      }

      if (command === "off" || command === "on") {
        const enabled = command === "on";
        const persisted = setShowToolsOnStartup(enabled);
        const status = enabled ? "enabled" : "disabled";
        const suffix = persisted ? "" : " (not persisted; check ~/.pi/agent/settings.json)";
        ctx.ui.notify(
          `Tools auto-print on startup ${status}${suffix}`,
          persisted ? "info" : "warning"
        );
        return;
      }

      ctx.ui.notify("Usage: /tools [on|off]", "warning");
    },
  });

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    if (shouldShowToolsOnStartup()) {
      showTools(pi, ctx);
    }
  });
}
