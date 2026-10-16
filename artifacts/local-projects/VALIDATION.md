# Local projects validation

- Real WAV upload through the existing creation flow, original recording and analysis automatically saved.
- Reload opens My songs; draft resumes at the saved step.
- Completed song title, rendered/edited PCM, selected music, volume and mute survive reload.
- A reopened edited project exports a byte-identical WAV to its pre-close export.
- Rename, independent projects and sort-by-last-edit verified.
- Confirmed deletion removes project metadata and all owned audio assets atomically; cancel preserves both.
- Injected a synchronous storage quota failure: transaction rolls back, UI reports failure and prevents leaving the unsaved project; retry saves the current changes.
- Layout checked at 375px, 393px and desktop widths without document horizontal overflow.
- Model tests, ESLint, TypeScript and production Webpack build passed.

Repeatable checks:

```sh
node tests/localProjects.mjs
```

With the dev server running, and an existing Playwright installation and Chrome:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright CHROME_PATH=/path/to/chrome node tests/projectsBrowser.mjs
```

The integration test uses a fresh isolated browser context and deletes its own test projects. It does not use the user's browser profile.

- Explicit Save to My songs tested: rendered drafts remain Draft until confirmation; cancel preserves draft status; a failed commit keeps the naming dialog open; retry completes the existing project and opens the library. WAV export remains available as a secondary action.
