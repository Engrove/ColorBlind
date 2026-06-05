# Color Name Camera

Mobile camera web app for identifying colors from a live camera image.

The app returns two names:

1. **Exact color**: nearest named color from `rgb_combined_v05.csv` in `ayushoriginal/Optimized-RGB-To-ColorName`.
2. **Color family**: broad family derived from the measured RGB/HSL/Lab value, for example `Pink`, `Blue`, `Green`, `Brown`, `Gray`, `Black`, or `White`.

The broad family is intentionally calculated from the measured sample instead of blindly trusting the closest exact color. This prevents pale warm colors such as `#E7CEC2` from being classified as gray.

## Features

- English UI.
- Mobile camera with rear camera preference.
- Automatic center-target color sampling.
- Median and dominant-cluster sampling to reduce glare, shadows, texture, and noise.
- Exact nearest color name from the copied upstream RGB color-name data.
- Separate color family output.
- HEX/RGB/nearest HEX/Delta E/source display.
- Manual HEX tester.
- PWA manifest and service worker.
- Cloudflare Pages compatible static output.

## Local development

Requires Node.js 20 or newer.

```bash
npm run data:update
npm run dev
```

Open:

```text
http://localhost:8788
```

Camera access works on `localhost`. For a phone, deploy to HTTPS, for example Cloudflare Pages.

## Cloudflare Pages deployment

1. Create a new GitHub repository.
2. Copy this project into the repository and push it.
3. In Cloudflare Pages, choose **Connect to Git** and select the repository.
4. Use these settings:

```text
Framework preset: None
Build command: npm run build
Build output directory: dist
Node version: 20
```

During `npm run build`, the script downloads and copies the full upstream CSV into:

```text
public/data/rgb_combined_v05.csv
```

Then the static site is written to:

```text
dist
```

## No-build fallback

The app also contains a small sample CSV so the UI can open in restricted environments. That sample is not the production dataset. Production deployment should run `npm run build` so the full upstream dataset is copied into the deployed `dist/data/` directory.

## Data source and license

See `THIRD_PARTY_NOTICES.md`.

## Safety limitation

Camera color measurements are affected by light source, camera sensor, auto white balance, shadows, glare, dirt, lens quality, compression, material texture, paint aging, translucency, and screen calibration. Use the result as assistance, not as the sole source of truth for safety-critical electrical, automotive, medical, or industrial decisions.
