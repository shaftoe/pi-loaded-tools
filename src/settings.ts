import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface LoadedToolsSettings {
  showOnStartup?: boolean;
}

function getSettingsPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || homedir();
  return join(homeDir, ".pi", "agent", "settings.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readSettings(): Record<string, unknown> {
  const settingsPath = getSettingsPath();

  try {
    if (!existsSync(settingsPath)) {
      return {};
    }

    const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf-8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readSettingsForWrite(): Record<string, unknown> | undefined {
  const settingsPath = getSettingsPath();

  try {
    if (!existsSync(settingsPath)) {
      return {};
    }

    const parsed: unknown = JSON.parse(readFileSync(settingsPath, "utf-8"));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function getLoadedToolsSettings(settings: Record<string, unknown>): LoadedToolsSettings {
  const loadedTools = settings.loadedTools;
  return isRecord(loadedTools) ? loadedTools : {};
}

export function shouldShowToolsOnStartup(): boolean {
  const loadedTools = getLoadedToolsSettings(readSettings());
  return loadedTools.showOnStartup ?? true;
}

export function setShowToolsOnStartup(enabled: boolean): boolean {
  const settingsPath = getSettingsPath();
  const settings = readSettingsForWrite();

  if (!settings) {
    return false;
  }

  settings.loadedTools = {
    ...getLoadedToolsSettings(settings),
    showOnStartup: enabled,
  };

  try {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}
