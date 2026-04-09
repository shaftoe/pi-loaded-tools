/**
 * Types for the loaded tools extension.
 */

/**
 * Where a tool comes from.
 */
export type ToolSource = "builtin" | "sdk" | "extension";

/**
 * A loaded tool with all relevant metadata.
 */
export interface LoadedTool {
  /** Tool name (as known to LLM) */
  name: string;

  /** One-line description (first line, raw) */
  description: string;

  /** Whether this tool is currently active */
  active: boolean;

  /** Where this tool comes from */
  source: ToolSource;

  /** Extension path (for extension tools only) */
  extensionPath?: string;
}

/**
 * Grouped tools for display purposes.
 */
export interface ToolGroups {
  /** Built-in tools (Pi's core tools) */
  builtin: {
    active: LoadedTool[];
    inactive: LoadedTool[];
  };

  /** SDK tools (passed via customTools) */
  sdk: {
    active: LoadedTool[];
    inactive: LoadedTool[];
  };

  /** Extension tools (registered by extensions) */
  extensions: {
    active: LoadedTool[];
    inactive: LoadedTool[];
  };
}

/**
 * Summary stats for tools.
 */
export interface ToolStats {
  /** Total number of tools */
  total: number;

  /** Number of active tools */
  active: number;

  /** Number of inactive tools */
  inactive: number;

  /** Built-in tools */
  builtin: { total: number; active: number };

  /** SDK tools */
  sdk: { total: number; active: number };

  /** Extension tools */
  extensions: { total: number; active: number };
}
