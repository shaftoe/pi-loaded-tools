# pi-loaded-tools

[Pi coding agent](https://pi.dev) extension to list session's loaded tools.

Pi currently doesn't show this important information at startup nor elsewhere, installing this extension will show tools list at startup with active/inactive status and source labels, also prints the list on demand with `/tools` registered command.

## Example

![screenshot](./screenshot.png)

## Install

### From npm

```bash
pi install npm:@alexanderfortin/pi-loaded-tools
```

### From github

```bash
pi install git:github.com/shaftoe/pi-loaded-tools
```

## Usage

Run `/tools` inside a pi session to see the list of loaded tools.

```
/tools    # List all loaded tools with source provenance
```

## License

See [LICENSE](./LICENSE)
