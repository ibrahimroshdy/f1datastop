---
title: API and embeds
description: "Embed F1 DataStop standings tables on your own site, and how the site reaches its data."
---

Put F1 standings on your own page with an iframe, and see how the site reaches its data sources.

## Embeddable standings

Widgets are free to use with attribution. The data comes from Jolpica/Ergast and is subject to its terms.

```html
<iframe
  src="https://www.f1datastop.com/embed/driver-standings?season=2025&theme=dark"
  width="100%" height="500" frameborder="0"></iframe>
```

| Address | Shows |
| --- | --- |
| `/embed` | An overview of the widgets |
| `/embed/driver-standings` | Driver standings |
| `/embed/constructor-standings` | Constructor (team) standings |

| Option | Values | Default |
| --- | --- | --- |
| `season` | A year from 1950 to now. Anything that is not a number uses the current year. | Current year |
| `theme` | `light` or `dark` | `light` |
| `font` | `Roboto`, `Open Sans`, `Montserrat` or `Inter`. Anything else uses Inter. Spaces must be written as `%20`. | `Inter` |

The options are read in `web/src/components/embeddable/useEmbedParams.ts`.

### Tips

- Use `width="100%"` so it fits any screen. Heights of about 500 px (drivers) and 400 px (constructors) work well.
- The widget is self-contained: your page does not need extra CSS or JavaScript. It ends with a small F1 DataStop credit.
- If your site sets a Content Security Policy, allow frames from `www.f1datastop.com`.
- It works in current Chrome, Firefox, Safari and Edge.
- Testing locally: use `http://localhost:8080/embed/driver-standings?season=2025` as the iframe address.

The longer guide is [`web/docs/README-embed.md`](https://github.com/ibrahimroshdy/f1datastop/blob/main/web/docs/README-embed.md). The [Developers](/developers.html) page covers the public data, the request queues and the database tables you can read.

## How the site reaches its data

All requests to outside providers go through `web/src/lib/api/f1ApiFetch.ts`. With `VITE_F1_PROXY_ENABLED=true` they go to the `f1-proxy` server function and its cache; the site never pages through Jolpica itself (laps and pit stops are fetched page by page by the data jobs). The order of lookups is described in [How it works](/architecture.html).

## Same-site rewrites on Vercel

The file `vercel.json` in the project root lets the site call the providers from its own address, which avoids cross-site (CORS) errors:

```text
/api/ergast/:path*  →  https://api.jolpi.ca/ergast/:path*
/api/openf1/:path*  →  https://api.openf1.org/v1/:path*
social media bots   →  /api/og   (builds the preview image)
```

To use them, set `VITE_ERGAST_BASE=/api/ergast` and `VITE_OPENF1_BASE=/api/openf1`.
