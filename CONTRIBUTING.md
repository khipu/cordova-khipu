# Contributing

## Commit messages decide the release

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), and
commitlint checks each one in the `commit-msg` hook. `npm run release` runs release-it with
the `conventionalcommits` preset, which reads the commits since the last tag to pick the
next version and to write `CHANGELOG.md`:

| Commit type | Next version | In the changelog |
| --- | --- | --- |
| `feat!:`, `fix!:`, or any type with a `BREAKING CHANGE:` footer | major | yes |
| `feat:` | minor | Features |
| `fix:`, `perf:`, `revert:` | patch | Bug Fixes, Performance Improvements, Reverts |
| `chore:`, `docs:`, `ci:`, `build:`, `refactor:`, `test:`, `style:` | none | no |

**Raising a native SDK pin is a `fix(android):` or a `fix(ios):`, never a `chore:`.** A
`chore:` releases nothing, so merchants would not get the new SDK. Each pin lives in two
files, and `npm run verify:versions` fails if they drift apart.

If only types from the last row have landed since the last tag and a release is still
needed, pass the increment yourself: `npm run release -- patch`.
