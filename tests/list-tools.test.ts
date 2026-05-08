/**
 * Unit tests for the loaded tools extension.
 *
 * Covers:
 *   - src/tools/api.ts   (getAllLoadedTools, getToolGroups, getToolStats,
 *                          formatToolSource, getSourceLabel, truncateDescription)
 *   - src/tools/display.ts (showTools, formatToolsList)
 *   - src/index.ts        (extension entry point)
 */

import type { Theme, ToolInfo } from "@earendil-works/pi-coding-agent";
import { describe, expect, mock, test } from "bun:test";
import {
  formatToolSource,
  getAllLoadedTools,
  getSourceLabel,
  getToolGroups,
  getToolStats,
  truncateDescription,
} from "../src/tools/api.js";
import { formatToolsList, showTools } from "../src/tools/display.js";

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
  const messages: Array<{
    customType: string;
    content: string;
    display: boolean;
    details: unknown;
  }> = [];
  return {
    getAllTools: mock(() => tools),
    getActiveTools: mock(() => active),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendMessage: mock((msg: any) => {
      messages.push(msg);
    }),
    registerCommand: mock(() => {}),
    registerMessageRenderer: mock(() => {}),
    on: mock(() => {}),
    _messages: messages,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

/** Create a minimal mock ctx. */
function mockCtx() {
  return {
    ui: {
      notify: mock(() => {}),
      theme: {
        fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
        bg: (_color: string, text: string) => text,
        bold: (text: string) => `*${text}*`,
      },
    },
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
      scope: "temporary",
      origin: "top-level",
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
      scope: "user",
      origin: "package",
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
      scope: "temporary",
      origin: "top-level",
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

  test("preserves project scope for extension tools", () => {
    const tool = makeTool({
      name: "project_tool",
      source: "local",
      scope: "project",
      origin: "top-level",
      path: ".pi/extensions/my-ext/index.ts",
    });
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.scope).toBe("project");
  });

  test("preserves user scope for extension tools", () => {
    const tool = makeTool({
      name: "user_tool",
      source: "npm:@scope/pkg",
      scope: "user",
      origin: "package",
      path: "npm:@scope/pkg/dist/index.js",
    });
    const [t] = getAllLoadedTools([tool], new Set());
    expect(t!.scope).toBe("user");
    expect(t!.origin).toBe("package");
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
// formatToolsList
// ---------------------------------------------------------------------------

describe("formatToolsList", () => {
  const theme = {
    fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => `*${text}*`,
  } as unknown as Theme;

  test("renders header with mdHeading color", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" })],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨mdHeading⟩[Tools]⟨/⟩");
  });

  test("groups builtin tools under 'builtin' scope with accent label", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "read", source: "builtin", path: "<builtin:read>" }),
      ],
      new Set(["bash", "read"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨accent⟩builtin⟨/⟩");
    expect(output).toContain("● bash");
    expect(output).toContain("● read");
  });

  test("shows inactive tools with ○ prefix", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "grep", source: "builtin", path: "<builtin:grep>" })],
      new Set()
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("○ grep");
  });

  test("groups extension tools by scope", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({
          name: "proj_tool",
          source: "local",
          scope: "project",
          origin: "top-level",
          path: ".pi/extensions/my-ext.ts",
        }),
        makeTool({
          name: "user_tool",
          source: "npm:@scope/pkg",
          scope: "user",
          origin: "package",
          path: "npm:@scope/pkg/dist/index.js",
        }),
      ],
      new Set(["proj_tool", "user_tool"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨accent⟩project⟨/⟩");
    expect(output).toContain("● proj_tool");
    expect(output).toContain("⟨accent⟩user⟨/⟩");
    expect(output).toContain("⟨mdLink⟩npm:@scope/pkg⟨/⟩");
    expect(output).toContain("● user_tool");
  });

  test("indents package items deeper than local items", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({
          name: "local_tool",
          source: "local",
          scope: "project",
          origin: "top-level",
          path: ".pi/ext.ts",
        }),
        makeTool({
          name: "pkg_tool",
          source: "npm:@s/p",
          scope: "project",
          origin: "package",
          path: "npm:@s/p/dist/index.js",
        }),
      ],
      new Set()
    );
    const output = formatToolsList(tools, theme);
    // Local items: 4 spaces indent (    ○)
    const localMatch = output.match(/    ○ local_tool/);
    expect(localMatch).not.toBeNull();
    // Package items: 6 spaces indent (      ○)
    const pkgMatch = output.match(/      ○ pkg_tool/);
    expect(pkgMatch).not.toBeNull();
  });

  test("shows stats line with dim color", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({
          name: "ext",
          source: "npm:@s/p",
          scope: "user",
          origin: "package",
          path: "npm:@s/p/dist/index.js",
        }),
      ],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨dim⟩  2 tools · 1 active · 1 from extension⟨/⟩");
  });

  test("omits extension count from stats when no extension tools", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" })],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("1 tool · 1 active");
    expect(output).not.toContain("from extensions");
  });

  test("handles empty tools list", () => {
    const output = formatToolsList([], theme);
    expect(output).toContain("⟨mdHeading⟩[Tools]⟨/⟩");
    expect(output).toContain("0 tools · 0 active");
  });

  test("uses dim color for tool items", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" })],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨dim⟩    ● bash⟨/⟩");
  });
});

// ---------------------------------------------------------------------------
// showTools
// ---------------------------------------------------------------------------

describe("showTools", () => {
  test("sends message via pi.sendMessage with correct customType and display", () => {
    const tools = [
      makeTool({
        name: "bash",
        source: "builtin",
        path: "<builtin:bash>",
      }),
    ];
    const pi = mockPi(tools, ["bash"]);
    const ctx = mockCtx();

    showTools(pi, ctx);

    expect(pi.sendMessage).toHaveBeenCalledTimes(1);
    const msg = pi._messages[0]!;
    expect(msg.customType).toBe("pi-loaded-tools");
    expect(msg.display).toBe(true);
    expect(msg.content).toContain("1 tool");
    expect(msg.content).toContain("1 active");
  });

  test("stores loaded tools in details", () => {
    const tools = [
      makeTool({
        name: "bash",
        source: "builtin",
        path: "<builtin:bash>",
      }),
      makeTool({
        name: "web_search",
        source: "npm:@foo/tavily",
        scope: "user",
        origin: "package",
        path: "npm:@foo/tavily/dist/index.js",
      }),
    ];
    const pi = mockPi(tools, ["bash", "web_search"]);
    const ctx = mockCtx();

    showTools(pi, ctx);

    const details = pi._messages[0]!.details as { tools: Array<{ name: string }> };
    expect(details.tools).toHaveLength(2);
    expect(details.tools.map((t) => t.name)).toEqual(["bash", "web_search"]);
  });

  test("calls pi.getAllTools and pi.getActiveTools", () => {
    const pi = mockPi([], []);
    const ctx = mockCtx();

    showTools(pi, ctx);

    expect(pi.getAllTools).toHaveBeenCalledTimes(1);
    expect(pi.getActiveTools).toHaveBeenCalledTimes(1);
  });

  test("reports correct counts for mixed tools", () => {
    const tools = [
      makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
      makeTool({ name: "read", source: "builtin", path: "<builtin:read>" }),
      makeTool({ name: "ext", source: "local", path: "~/ext.js" }),
    ];
    const pi = mockPi(tools, ["bash", "read"]);
    const ctx = mockCtx();

    showTools(pi, ctx);

    const msg = pi._messages[0]!;
    expect(msg.content).toContain("3 tools");
    expect(msg.content).toContain("2 active");
  });
});

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

describe("buildToolGroups (via formatToolsList)", () => {
  const theme = {
    fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => `*${text}*`,
  } as unknown as Theme;

  test("groups SDK tools under 'path' scope", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "sdk_tool", source: "sdk", path: "sdk:x" })],
      new Set(["sdk_tool"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨accent⟩path⟨/⟩");
    expect(output).toContain("● sdk_tool");
  });

  test("groups temporary-scope extension tools under 'path' scope", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({
          name: "temp_tool",
          source: "local",
          scope: "temporary",
          origin: "top-level",
          path: "/tmp/ext.js",
        }),
      ],
      new Set()
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("⟨accent⟩path⟨/⟩");
    expect(output).toContain("○ temp_tool");
  });

  test("sorts local tools alphabetically within a group", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "z_tool", source: "builtin", path: "<builtin:z>" }),
        makeTool({ name: "a_tool", source: "builtin", path: "<builtin:a>" }),
      ],
      new Set(["z_tool", "a_tool"])
    );
    const output = formatToolsList(tools, theme);
    const aPos = output.indexOf("● a_tool");
    const zPos = output.indexOf("● z_tool");
    expect(aPos).toBeLessThan(zPos);
  });

  test("sorts package tools alphabetically within a package", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({
          name: "z_pkg_tool",
          source: "npm:@s/p",
          scope: "user",
          origin: "package",
          path: "npm:@s/p/dist/index.js",
        }),
        makeTool({
          name: "a_pkg_tool",
          source: "npm:@s/p",
          scope: "user",
          origin: "package",
          path: "npm:@s/p/dist/index.js",
        }),
      ],
      new Set(["z_pkg_tool", "a_pkg_tool"])
    );
    const output = formatToolsList(tools, theme);
    const aPos = output.indexOf("● a_pkg_tool");
    const zPos = output.indexOf("● z_pkg_tool");
    expect(aPos).toBeLessThan(zPos);
  });

  test("sorts packages alphabetically within a group", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({
          name: "t1",
          source: "npm:@z/p",
          scope: "user",
          origin: "package",
          path: "npm:@z/p/dist/index.js",
        }),
        makeTool({
          name: "t2",
          source: "npm:@a/p",
          scope: "user",
          origin: "package",
          path: "npm:@a/p/dist/index.js",
        }),
      ],
      new Set(["t1", "t2"])
    );
    const output = formatToolsList(tools, theme);
    const aPos = output.indexOf("npm:@a/p");
    const zPos = output.indexOf("npm:@z/p");
    expect(aPos).toBeLessThan(zPos);
  });

  test("stats line uses singular 'tool' and 'extension' for count of 1", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({
          name: "ext",
          source: "npm:@s/p",
          scope: "user",
          origin: "package",
          path: "npm:@s/p/dist/index.js",
        }),
      ],
      new Set(["ext"])
    );
    const output = formatToolsList(tools, theme);
    expect(output).toContain("1 tool · 1 active · 1 from extension");
    expect(output).not.toContain("1 tools");
    expect(output).not.toContain("1 extensions");
  });
});

describe("formatToolsList compact mode", () => {
  const theme = {
    fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
    bg: (_color: string, text: string) => text,
    bold: (text: string) => `*${text}*`,
  } as unknown as Theme;

  test("compact mode shows single line listing tool names with bold header", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "read", source: "builtin", path: "<builtin:read>" }),
      ],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme, true);
    expect(output).toContain("\x1b[1m[Tools]\x1b[22m");
    expect(output).toContain("⟨dim⟩  bash, read⟨/⟩");
    expect(output).toContain("\n");
  });

  test("compact mode lists tool names sorted alphabetically", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "read", source: "builtin", path: "<builtin:read>" }),
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "edit", source: "builtin", path: "<builtin:edit>" }),
      ],
      new Set(["read", "bash", "edit"])
    );
    const output = formatToolsList(tools, theme, true);
    expect(output).toContain("bash, edit, read");
  });

  test("compact mode does not show scope groups or active indicators", () => {
    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({
          name: "ext",
          source: "npm:@s/p",
          scope: "user",
          origin: "package",
          path: "npm:@s/p/dist/index.js",
        }),
      ],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme, true);
    expect(output).not.toContain("●");
    expect(output).not.toContain("○");
  });

  test("compact mode handles empty tools", () => {
    const output = formatToolsList([], theme, true);
    expect(output).toContain("\x1b[1m[Tools]\x1b[22m");
    expect(output).toContain("(none)");
  });

  test("expanded mode (default) still works unchanged", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" })],
      new Set(["bash"])
    );
    const output = formatToolsList(tools, theme, false);
    expect(output).toContain("⟨mdHeading⟩[Tools]⟨/⟩");
    expect(output).toContain("⟨accent⟩builtin⟨/⟩");
    expect(output).toContain("● bash");
    expect(output).toContain("⟨dim⟩  1 tool · 1 active⟨/⟩");
  });

  test("compact mode default parameter is false", () => {
    const tools = getAllLoadedTools(
      [makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" })],
      new Set(["bash"])
    );
    const defaultOutput = formatToolsList(tools, theme);
    const explicitExpanded = formatToolsList(tools, theme, false);
    expect(defaultOutput).toBe(explicitExpanded);
  });
});

describe("message renderer", () => {
  test("renderer callback falls back to empty array when details is missing", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();

    mod.default(pi);

    const renderer = pi.registerMessageRenderer.mock.calls[0]![1];
    const theme = {
      fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
      bg: (_color: string, text: string) => text,
      bold: (text: string) => `*${text}*`,
    } as unknown as Theme;

    const result = renderer({}, { expanded: true }, theme);
    expect(result).toBeDefined();
    expect(result.text).toContain("[Tools]");
    expect(result.text).toContain("0 tools");
  });

  test("renderer callback uses tools from message.details (expanded)", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();

    mod.default(pi);

    const tools = getAllLoadedTools(
      [makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" })],
      new Set(["bash"])
    );

    const renderer = pi.registerMessageRenderer.mock.calls[0]![1];
    const theme = {
      fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
      bg: (_color: string, text: string) => text,
      bold: (text: string) => `*${text}*`,
    } as unknown as Theme;

    const result = renderer({ details: { tools } }, { expanded: true }, theme);
    expect(result).toBeDefined();
    expect(result.text).toContain("1 tool");
    expect(result.text).toContain("● bash");
  });

  test("renderer shows compact mode when not expanded", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();

    mod.default(pi);

    const tools = getAllLoadedTools(
      [
        makeTool({ name: "bash", source: "builtin", path: "<builtin:bash>" }),
        makeTool({ name: "read", source: "builtin", path: "<builtin:read>" }),
      ],
      new Set(["bash"])
    );

    const renderer = pi.registerMessageRenderer.mock.calls[0]![1];
    const theme = {
      fg: (_color: string, text: string) => `⟨${_color}⟩${text}⟨/⟩`,
      bg: (_color: string, text: string) => text,
      bold: (text: string) => `*${text}*`,
    } as unknown as Theme;

    const result = renderer({ details: { tools } }, { expanded: false }, theme);
    expect(result).toBeDefined();
    expect(result.text).toContain("\x1b[1m[Tools]\x1b[22m");
    expect(result.text).toContain("bash, read");
    expect(result.text).not.toContain("● bash");
  });
});

describe("extension entry point", () => {
  test("registers /tools command, session_start listener, and message renderer", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();

    mod.default(pi);

    expect(pi.registerCommand).toHaveBeenCalledTimes(1);
    expect(pi.registerCommand.mock.calls[0]![0]).toBe("tools");

    expect(pi.on).toHaveBeenCalledTimes(1);
    expect(pi.on.mock.calls[0]![0]).toBe("session_start");

    expect(pi.registerMessageRenderer).toHaveBeenCalledTimes(1);
    expect(pi.registerMessageRenderer.mock.calls[0]![0]).toBe("pi-loaded-tools");
  });

  test("command handler calls showTools", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();
    const ctx = mockCtx();

    mod.default(pi);

    const handler = pi.registerCommand.mock.calls[0]![1]!.handler;
    await handler("", ctx);

    expect(pi.sendMessage).toHaveBeenCalled();
  });

  test("session_start handler calls showTools only on first invocation", async () => {
    const mod = await import("../src/index.js");
    const pi = mockPi();
    const ctx = mockCtx();

    mod.default(pi);

    const sessionHandler = pi.on.mock.calls[0]![1];

    // First session_start (boot) — should show tools
    await sessionHandler({}, ctx);
    expect(pi.sendMessage).toHaveBeenCalledTimes(1);

    // Second session_start (/new) — should NOT show tools
    await sessionHandler({}, ctx);
    expect(pi.sendMessage).toHaveBeenCalledTimes(1);
  });
});
