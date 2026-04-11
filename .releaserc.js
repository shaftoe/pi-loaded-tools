/**
 * Semantic Release configuration.
 *
 * Uses @semantic-release/exec to run format/lint fixes after CHANGELOG.md
 * and package.json are updated, ensuring committed files always pass validation.
 */

const changelogTitle = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]`;

export default {
  branches: ["master"],
  plugins: [
    "@semantic-release/commit-analyzer",
    [
      "@semantic-release/release-notes-generator",
      {
        writerOpts: {
          mainTemplate: `{{> header}}\n{{#each commitGroups}}{{#if title}}\n### {{title}}\n{{/if}}{{#each commits}}{{> commit root=@root}}{{/each}}{{/each}}{{> footer}}`,
          headerPartial: `## [{{version}}] - {{date}}\n`,
          commitPartial: `- {{#if scope}}**{{scope}}:** {{/if}}{{#if subject}}{{subject}}{{else}}{{header}}{{/if}}\n`,
          footerPartial: `{{#if noteGroups}}{{#each noteGroups}}\n### {{title}}\n{{#each notes}}- {{#if commit.scope}}**{{commit.scope}}:** {{/if}}{{text}}\n{{/each}}{{/each}}{{/if}}`,
        },
      },
    ],
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle,
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "bun run format:fix && bun run lint:fix",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: ["dist/*"],
        successComment: false,
      },
    ],
  ],
  tagFormat: "v${version}",
};
