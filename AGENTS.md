# Repository workflow

- Keep README.md focused on node users. Put release/development instructions in docs/RELEASING.md.
- After user-authorized release changes, use `npm run release` for the complete push/tag/GitHub Release flow. Do not replace it with a standalone `git push`.
- When package.json already contains the intended release version, use `npm run release -- --current`; otherwise the default increments patch. Update CHANGELOG.md for the target version and commit changes before running the command.
- A release is complete only after remote branch/tag and Release assets pass verification. Never force-move a published tag.
- Never publish to npm: the user publishes npm manually.
