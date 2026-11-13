# Authentication validation

- `pnpm test`: 66 tests passed in 10 files.
- `pnpm typecheck`: passed.
- `pnpm build`: passed with Next.js 16.4.6.
- Production browser checks passed for login and signup at 1440×900, 1024×600, 768×1024, 390×844, and 320×568.
- No horizontal overflow or browser JavaScript errors. All six provider marks resolve to bundled SVG masks. Inputs use 16px text. Phones show the form first; both submit actions fit in the initial viewport down to 320×568.
- Password mismatch is announced; switching modes clears the error and changes password autocomplete correctly. A mocked invalid-credentials response verifies loading locks, form values retained after failure, and recovery. Keyboard navigation follows email, password, submit.
- Text contrast checked against actual surfaces: all secondary text exceeds 4.5:1; primary action white text exceeds 4.5:1.
- Mechanical detector: zero non-advisory findings. Shared stylesheet advisories and existing stale design sidecar are recorded in detector-summary.json. No unrelated design-system refresh.
- Independent finish review: **ship**. No material fixes requested.

Desktop and mobile JPEGs in this directory are production-preview review evidence, not shipping image assets. Existing licensed provider SVGs are reused. Narrow-phone and tablet captures were inspected locally; they are not added to the repository.

## Merge validation

After integrating main’s disabled-model support, 68 tests, TypeScript checking, and the production build passed. Regression coverage checks the enabled-model count, exclusion of disabled models from the auth showcase and new selectors, and retained labels/selections for existing rooms. The Google preview now features Gemini 3.8 Flash; the count includes only enabled models. Desktop and mobile previews were refreshed.
