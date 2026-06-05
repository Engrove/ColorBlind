# Color Name Camera

Mobile-first camera app for naming colors. It samples the camera image and shows two names:

1. **Closest color name** from `rgb_combined_v05.csv` in `ayushoriginal/Optimized-RGB-To-ColorName`.
2. **Color family** calculated from the measured RGB value, such as Black, Gray, Beige, Pink, Blue or Green.

The app is built as a static PWA and is ready for GitHub + Cloudflare Pages.


## Fix in this version

The top-left error `color data error: Too few colors loaded` is handled defensively now:

- CSV loading validates the expected `_Hex`, `_Red`, `_Green`, `_Blue` and `_Title` columns.
- If the local CSV path returns an HTML/404 fallback page, it is rejected instead of parsed as color data.
- The service worker no longer proxies cross-origin GitHub raw CSV requests.
- Data CSV requests are network-first and use a new cache version.
- If both local and upstream CSV loading fail, the app still starts with an embedded emergency color fallback instead of showing `No sample` forever.
- `dist/build-info.json` is written during Cloudflare build so you can confirm how many color rows were deployed.

## What changed in this mobile-optimized version

- The large result card was replaced with a compact bottom sheet.
- The sampling reticle is moved above the sheet and can be moved by tapping the camera image.
- Technical values and manual HEX testing are collapsed under **Details**.
- Controls are smaller, stable and arranged in a 3 x 2 grid.
- The app now samples from the visible reticle position, not from the hidden center of the video.
- The color name selector penalizes generic dataset labels such as `gray3`, `red2`, `blue4` when a more useful nearby name exists.
- The family is calculated from the measured camera color, not blindly copied from the dataset name.
- Data loading is network-first for the CSV so Cloudflare updates do not get stuck behind an old service worker cache.

## Repository layout

```text
public/
  index.html
  styles.css
  app.js
  manifest.webmanifest
  service-worker.js
  data/rgb_combined_v05.csv       # fallback sample unless updated
scripts/
  build.mjs                       # Cloudflare Pages build
  download-colors.mjs             # downloads full upstream CSV for local use
  dev.mjs                         # dependency-free local server
package.json
wrangler.toml
LICENSE.upstream
```

## Local development

Camera access works on `localhost` or HTTPS.

```bash
npm run data:update
npm run dev
```

Open:

```text
http://localhost:8788
```

## Cloudflare Pages deployment

Use these settings:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Node version: 20
```

The build downloads the full `rgb_combined_v05.csv` file from GitHub and writes it into `dist/data/rgb_combined_v05.csv`. The browser then loads the CSV locally from your deployed Cloudflare Pages site.

## Manual GitHub setup

```bash
git init
git add .
git commit -m "Add mobile optimized color camera app"
git branch -M main
git remote add origin https://github.com/YOUR-USER/YOUR-REPO.git
git push -u origin main
```

Then connect that repository in Cloudflare Pages.

## Notes on accuracy

Mobile cameras apply automatic white balance, exposure, sharpening and noise reduction. Glossy, dirty or textured surfaces can still produce unstable values. Use even light and fill the reticle with the target surface. For safety-critical electrical or mechanical work, do not use this app as the only source of truth.

## Data and license

Color data source: `ayushoriginal/Optimized-RGB-To-ColorName`, file `rgb_combined_v05.csv`.

The upstream project is MIT licensed. The license text is included in `LICENSE.upstream`.
