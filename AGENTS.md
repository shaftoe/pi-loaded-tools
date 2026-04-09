# AGENTS.md

This package provides an extension for the Pi coding agent.

## Usage

The extension is automatically loaded by Pi when installed. It provides a `tools` command that shows all loaded tools with source provenance and active status.

```
/tools    # List all loaded tools with source provenance
```

## Style

- don't add unnecessary inline comments, prefer function documentation

## Package Management

- **Package Manager:** Use [Bun](https://bun.sh) for all package management operations

## Linting and Type Checking

- run `bun run lint:fix` and `bun run format:fix` to keep all things tidy
- don't consider any change ready until `bun run validate` and `bun run test` returning 0 errors and 0 warnings.
