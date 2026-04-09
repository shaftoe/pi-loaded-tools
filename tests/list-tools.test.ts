/**
 * Unit tests for the loaded tools extension.
 *
 * Covers:
 *   - src/tools/api.ts   (getAllLoadedTools, getToolGroups, getToolStats,
 *                          formatToolSource, getSourceLabel, truncateDescription)
 *   - src/tools/display.ts (showTools)
 *   - src/index.ts        (extension entry point)
 */

import type { ToolInfo } from "@mariozechner/pi-coding-agent";
import { describe, expect, mock, test } from "bun:test";
import {
  formatToolSource,
  getAllLoadedTools,
  getSourceLabel,
  getToolGroups,
  getToolStats,
  truncateDescription,
} from "../src/tools/api.js";
import { showTools } from "../src/tools/display.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake ToolInfo with sensible defaults. */
function makeTool(
  overrides: Partial<{
    name: string;
    description: string;
    source: string;
    scope: string;
    origin: string;
    path: string;
  }> = {}
): ToolInfo {
  return {
    name: overrides.name ?? "test_tool",
    description: overrides.description ?? "A test tool",
    parameters: {} as ToolInfo["parameters"],
    sourceInfo: {
      source: overrides.source ?? "builtin",
      scope: (overrides.scope as ToolInfo["sourceInfo"]["scope"]) ?? "temporary",
      origin: (overrides.origin as ToolInfo["sourceInfo"]["origin"]) ?? "top-level",
      path: overrides.path ?? "<builtin:test_tool>",
    },
  };
}

/** Create a minimal mock pi object. */
function mockPi(tools: ToolInfo[] = [], active: string[] = []) {
  return {
    getAllTools: mock(() => tools),
    getActiveTools: mock(() => active),
    registerCommand: mock(() => {}),
    on: mock(() => {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Create a minimal mock ctx with a captured notify output. */
function mockCtx() {
  const notifications: Array<{ message: string; type: string }> = [];
  return {
    ui: {
      notify: mock((message: string, type: string) => {
        notifications.push({ message, type });
      }),
      theme: {
        fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
        bg: (_color: string, text: string) => text,
        bold: (text: string) => `*${text}*`,
      },
    },
    _notifications: notifications,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ---------------------------------------------------------------------------
// getAllLoadedTools
// ---------------------------------------------------------------------------

describe("getAllLoadedTools", () => {
  test("maps builtin tools correctly", () => {
    const tool = makeTool({
      name: "bash",
      source: "builtin",
      path: "<builtin:bash>",
    });
    const [t] = getAllLoadedTools([tool], new Set(["bash"]));
    expect(t).toEqual({
      name: "bash",
      description: "A test tool",
      active: true,
      source: "builtin",
      extensionPath: undefined,
    });
  });

  test("maps sdk tools correctly", () => {
    const tool = makeTool({
      name: "my_sdk_tool",
      source: "sdk",
      path: "sdk:custom",
    });
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.source).toBe("sdk");
    expect(t!.active).toBe(false);
    expect(t!.extensionPath).toBeUndefined();
  });

  test("maps npm package extension tools with package name as extensionPath", () => {
    const tool = makeTool({
      name: "web_search",
      source: "npm:@foo/tavily",
      scope: "user",
      origin: "package",
      path: "npm:@foo/tavily/dist/index.js",
    });
    const [t] = getAllLoadedTools([tool], new Set(["web_search"]));
    expect(t).toEqual({
      name: "web_search",
      description: "A test tool",
      active: true,
      source: "extension",
      extensionPath: "npm:@foo/tavily",
    });
  });

  test("maps local extension tools with file path as extensionPath", () => {
    const tool = makeTool({
      name: "my_tool",
      source: "local",
      origin: "top-level",
      path: "~/git/my-ext/dist/index.js",
    });
    const [t] = getAllLoadedTools([tool], new Set(["my_tool"]));
    expect(t).toEqual({
      name: "my_tool",
      description: "A test tool",
      active: true,
      source: "extension",
      extensionPath: "~/git/my-ext/dist/index.js",
    });
  });

  test("detects builtin via angle-bracket path even if raw source is not 'builtin'", () => {
    const tool = makeTool({
      name: "read",
      source: "local",
      path: "<builtin:read>",
    });
    const [t] = getAllLoadedTools([tool], new Set(["read"]));
    expect(t!.source).toBe("builtin");
  });

  test("handles missing sourceInfo gracefully", () => {
    const tool: ToolInfo = {
      name: "orphan",
      description: "No sourceInfo",
      parameters: {} as ToolInfo["parameters"],
      sourceInfo: undefined as unknown as ToolInfo["sourceInfo"],
    };
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.source).toBe("extension");
    expect(t!.extensionPath).toBeUndefined();
  });

  test("takes only first line of multiline description", () => {
    const tool = makeTool({ description: "First line\nSecond line" });
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.description).toBe("First line");
  });

  test("handles empty description", () => {
    const tool = makeTool({ description: "" });
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.description).toBe("");
  });

  test("handles local source for extension with no package origin", () => {
    const tool = makeTool({
      name: "ext_tool",
      source: "local",
      origin: "top-level",
      path: "/some/local/ext.js",
    });
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.source).toBe("extension");
    expect(t!.extensionPath).toBe("/some/local/ext.js");
  });

  test("returns empty array for no tools", () => {
    expect(getAllLoadedTools([], new Set())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getToolGroups (now accepts LoadedTool[])
// ---------------------------------------------------------------------------

describe("getToolGroups", () => {
  test("groups builtin, sdk, and extension tools", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "sdk_tool", source: "sdk", path: "sdk:x" }),
        makeTool({ name: "ext_tool", source: "local", path: "~/ext.js" }),
      ],
      new Set(["bash", "ext_tool"])
    );
    const groups = getToolGroups(tools);

    expect(groups.builtin.active).toHaveLength(1);
    expect(groups.builtin.active[0]!.name).toBe("bash");
    expect(groups.builtin.inactive).toHaveLength(0);

    expect(groups.sdk.active).toHaveLength(0);
    expect(groups.sdk.inactive).toHaveLength(1);
    expect(groups.sdk.inactive[0]!.name).toBe("sdk_tool");

    expect(groups.extensions.active).toHaveLength(1);
    expect(groups.extensions.active[0]!.name).toBe("ext_tool");
    expect(groups.extensions.inactive).toHaveLength(0);
  });

  test("returns empty groups for no tools", () => {
    const groups = getToolGroups([]);
    expect(groups.builtin.active).toHaveLength(0);
    expect(groups.builtin.inactive).toHaveLength(0);
    expect(groups.sdk.active).toHaveLength(0);
    expect(groups.sdk.inactive).toHaveLength(0);
    expect(groups.extensions.active).toHaveLength(0);
    expect(groups.extensions.inactive).toHaveLength(0);
  });

  test("all tools inactive when activeNames is empty", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "ext", source: "local", path: "~/ext.js" }),
      ],
      new Set()
    );
    const groups = getToolGroups(tools);
    expect(groups.builtin.active).toHaveLength(0);
    expect(groups.builtin.inactive).toHaveLength(1);
    expect(groups.extensions.active).toHaveLength(0);
    expect(groups.extensions.inactive).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getToolStats (now accepts LoadedTool[])
// ---------------------------------------------------------------------------

describe("getToolStats", () => {
  test("computes correct stats for mixed tools", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "read", source: "builtin", path: "<builtin:read>" }),
        makeTool({ name: "sdk_tool", source: "sdk", path: "sdk:x" }),
        makeTool({ name: "ext_tool", source: "local", path: "~/ext.js" }),
        makeTool({
          name: "ext2",
          source: "npm:@foo/bar",
          origin: "package",
          path: "npm:@foo/bar/dist/index.js",
        }),
      ],
      new Set(["bash", "read", "ext_tool"])
    );
    const stats = getToolStats(tools);

    expect(stats.total).toBe(5);
    expect(stats.active).toBe(3);
    expect(stats.inactive).toBe(2);
    expect(stats.builtin).toEqual({ total: 2, active: 2 });
    expect(stats.sdk).toEqual({ total: 1, active: 0 });
    expect(stats.extensions).toEqual({ total: 2, active: 1 });
  });

  test("returns zeroes for empty tools", () => {
    const stats = getToolStats([]);
    expect(stats.total).toBe(0);
    expect(stats.active).toBe(0);
    expect(stats.inactive).toBe(0);
    expect(stats.builtin).toEqual({ total: 0, active: 0 });
    expect(stats.sdk).toEqual({ total: 0, active: 0 });
    expect(stats.extensions).toEqual({ total: 0, active: 0 });
  });
});

// ---------------------------------------------------------------------------
// truncateDescription
// ---------------------------------------------------------------------------

describe("truncateDescription", () => {
  test("keeps short strings unchanged", () => {
    expect(truncateDescription("hello")).toBe("hello");
  });

  test("keeps exactly 120 chars unchanged", () => {
    const exact = "A".repeat(120);
    expect(truncateDescription(exact)).toBe(exact);
  });

  test("truncates strings longer than 120 chars", () => {
    const long = "A".repeat(130);
    const result = truncateDescription(long);
    expect(result).toHaveLength(120);
    expect(result.endsWith("...")).toBe(true);
  });

  test("handles empty string", () => {
    expect(truncateDescription("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatToolSource
// ---------------------------------------------------------------------------

describe("formatToolSource", () => {
  test("returns 'built-in' for builtin", () => {
    expect(formatToolSource("builtin")).toBe("built-in");
  });

  test("returns 'SDK' for sdk", () => {
    expect(formatToolSource("sdk")).toBe("SDK");
  });

  test("returns npm package name as-is", () => {
    expect(formatToolSource("extension", "npm:@foo/bar")).toBe("npm:@foo/bar");
  });

  test("strips /dist/index.js suffix", () => {
    expect(formatToolSource("extension", "npm:@foo/bar/dist/index.js")).toBe("npm:@foo/bar");
    expect(formatToolSource("extension", "~/git/my-ext/dist/index.js")).toBe("~/git/my-ext");
  });

  test("returns path as-is when no /dist/index.js suffix", () => {
    expect(formatToolSource("extension", "~/git/my-ext")).toBe("~/git/my-ext");
    expect(formatToolSource("extension", "/abs/path.js")).toBe("/abs/path.js");
  });

  test("returns 'extension' when extensionPath is undefined", () => {
    expect(formatToolSource("extension")).toBe("extension");
    expect(formatToolSource("extension", undefined)).toBe("extension");
  });

  test("handles path that is only /dist/index.js (replace yields empty, falls back)", () => {
    expect(formatToolSource("extension", "/dist/index.js")).toBe("/dist/index.js");
  });
});

// ---------------------------------------------------------------------------
// getSourceLabel
// ---------------------------------------------------------------------------

describe("getSourceLabel", () => {
  test("returns 'Built-in' for builtin", () => {
    expect(getSourceLabel("builtin")).toBe("Built-in");
  });

  test("returns 'SDK' for sdk", () => {
    expect(getSourceLabel("sdk")).toBe("SDK");
  });

  test("returns 'Extensions' for extension", () => {
    expect(getSourceLabel("extension")).toBe("Extensions");
  });
});

// ---------------------------------------------------------------------------
// showTools
// ---------------------------------------------------------------------------

describe("showTools", () => {
  test("calls notify with formatted output", () => {
    const tools = [
      makeTool({
        name: "bash",
        source: "builtin",
        path: "<builtin:bash>",
      }),
      makeTool({
        name: "web_search",
        source: "npm:@foo/tavily",
        origin: "package",
        path: "npm:@foo/tavily/dist/index.js",
      }),
    ];
    const pi = mockPi(tools, ["bash", "web_search"]);
    const ctx = mockCtx();

    showTools(pi, ctx);

    expect(ctx._notifications).toHaveLength(1);
    const output = ctx._notifications[0]!.message;
    expect(ctx._notifications[0]!.type).toBe("info");

    // Header
    expect(output).toContain("[Tools]");

    // Active tools
    expect(output).toContain("● bash");
    expect(output).toContain("[built-in]");
    expect(output).toContain("● web_search");
    expect(output).toContain("[npm:@foo/tavily]");
  });

  test("shows inactive tools with ○ prefix", () => {
    const tools = [
      makeTool({
        name: "bash",
        source: "builtin",
        path: "<builtin:bash>",
      }),
      makeTool({
        name: "grep",
        source: "builtin",
        path: "<builtin:grep>",
      }),
    ];
    const pi = mockPi(tools, ["bash"]);
    const ctx = mockCtx();

    showTools(pi, ctx);

    const output = ctx._notifications[0]!.message;
    expect(output).toContain("○ grep");
    expect(output).toContain("● bash");
  });

  test("shows only inactive tools when none are active", () => {
    const tools = [
      makeTool({
        name: "bash",
        source: "builtin",
        path: "<builtin:bash>",
      }),
    ];
    const pi = mockPi(tools, []);
    const ctx = mockCtx();

    showTools(pi, ctx);

    const output = ctx._notifications[0]!.message;
    expect(output).toContain("○ bash");
    expect(output).not.toContain("●");
  });

  test("handles empty tools list", () => {
    const pi = mockPi([], []);
    const ctx = mockCtx();

    showTools(pi, ctx);

    const output = ctx._notifications[0]!.message;
    expect(output).toContain("Tools]");
  });

  test("calls pi.getAllTools and pi.getActiveTools", () => {
    const pi = mockPi([], []);
    const ctx = mockCtx();

    showTools(pi, ctx);

    expect(pi.getAllTools).toHaveBeenCalledTimes(1);
    expect(pi.getActiveTools).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

describe("extension entry point", () => {
  test("registers /tools command and session_start listener", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();

    mod.default(pi);

    expect(pi.registerCommand).toHaveBeenCalledTimes(1);
    expect(pi.registerCommand.mock.calls[0]![0]).toBe("tools");

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on.mock.calls[0]![0]).toBe("session_start");
  });

  test("command handler calls showTools", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();
    const ctx = mockCtx();

    mod.default(pi);

    const handler = pi.registerCommand.mock.calls[0]![1]!.handler;
    await handler("", ctx);

    expect(pi.getAllTools).toHaveBeenCalled();
    expect(ctx._notifications).toHaveLength(1);
  });

  test("session_start handler calls showTools", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();
    const ctx = mockCtx();

    mod.default(pi);

    const sessionHandler = pi.on.mock.calls[0]![1];
    await sessionHandler({}, ctx);

    expect(pi.getAllTools).toHaveBeenCalled();
    expect(ctx._notifications).toHaveLength(1);
  });
});
