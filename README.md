# OpenPanel UI (private)

The React/Vite UI for [OpenPanel](https://github.com/orgista/openpanel). The public
engine repo expects this repo's contents at `src/` — clone it there (or wire it as a
git submodule; see the engine repo's `docs/open-source-split.md`), then from the
engine root:

```sh
npm ci && npm run build && npx cap sync android
```

**Proprietary — all rights reserved.** The engine is MIT; this UI is not open source.
