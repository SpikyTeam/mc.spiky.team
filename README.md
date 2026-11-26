# mc.spiky.team

Source of [mc.spiky.team](https://mc.spiky.team). GitHub Pages serves the
`build/` artifact that `build.js` assembles; the `pages` workflow uploads it.

## What comes from where

| published at | source |
|---|---|
| `meta/index.json`, `meta/v1/**` | `meta-v1.zip`, the asset on the latest release of [`spiky-meta-staging`](../spiky-meta-staging), written by [`spiky-meta`](../spiky-meta) |
| `index.html` | `site/index.html` of [`SpikyMC-Sites`](../SpikyMC-Sites) |
| `wiki/`, `i18n/`, `maven/`, `fmllibs/`, `successful-login/` | the same repository |

The metadata is not committed anywhere in this repository: the build downloads
the zip, unpacks it into `meta/` and then copies the rest of the tree in. The
site's own landing page is static — the release cards and download links are
filled in by the page's script from the GitHub API, as before.

The `pages` workflow runs every 30 minutes, after every publishing job in the
other repositories, and by hand from the Actions tab.
