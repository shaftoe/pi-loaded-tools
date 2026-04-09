/**
 * Pi List Tools Extension
 *
 * Registers a /tools command and automatically shows loaded tools at startup.
 * Also exports a public API for querying loaded tools programmatically.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { showTools } from "./tools";

export default function (pi: ExtensionAPI): void {
  pi.registerCommand("tools", {
    description: "List all loaded tools with source provenance and active status",
    handler: async (_args, ctx) => {
      await Promise.resolve().then(() => showTools(pi, ctx));
    },
  });

  pi.on("session_start", (_event, ctx) => {
    showTools(pi, ctx);
  });
}
