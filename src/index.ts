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
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { formatToolsList, showTools, type LoadedTool } from "./tools";

export default function (pi: ExtensionAPI): void {
  pi.registerMessageRenderer<{ tools: LoadedTool[] }>(
    "pi-loaded-tools",
    (message, _options, theme) => {
      const tools: LoadedTool[] = message.details?.tools ?? [];
      return new Text(formatToolsList(tools, theme), 0, 0);
    }
  );

  pi.registerCommand("tools", {
    description: "List all loaded tools with source provenance and active status",
    handler: async (_args: string, ctx: ExtensionContext) => {
      await Promise.resolve(showTools(pi, ctx));
    },
  });

  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    showTools(pi, ctx);
  });
}
