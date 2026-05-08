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

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { formatToolsList, showTools, type LoadedTool } from "./tools";

export default function (pi: ExtensionAPI): void {
  pi.registerMessageRenderer<{ tools: LoadedTool[] }>(
    "pi-loaded-tools",
    (
      message: { details?: { tools: LoadedTool[] } },
      options: { expanded: boolean },
      theme: Theme
    ) => {
      const tools: LoadedTool[] = message.details?.tools ?? [];
      const compact = !options?.expanded;
      return new Text(formatToolsList(tools, theme, compact), 0, 0);
    }
  );

  pi.registerCommand("tools", {
    description: "List all loaded tools with source provenance and active status",
    handler: async (_args: string, ctx: ExtensionContext) => {
      await Promise.resolve(showTools(pi, ctx));
    },
  });

  let shownAtBoot = false;
  pi.on("session_start", (_event, ctx: ExtensionContext) => {
    if (shownAtBoot) return;
    shownAtBoot = true;
    showTools(pi, ctx);
  });
}
