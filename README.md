# OpenPanel UI

The React/Vite UI for [OpenPanel](https://github.com/orgista/openpanel). The public
engine repo expects this repo's contents at `src/` — clone it there (or wire it as a
git submodule; see the engine repo's `docs/open-source-split.md`), then from the
engine root:

```sh
npm ci && npm test && npm run typecheck && npm run build && npx cap sync android
```

The UI includes the Device Health admin/setup experience, restricted YouTube
source management, launcher surfaces, and remote/keyboard navigation.

MIT licensed — see [LICENSE](LICENSE).
