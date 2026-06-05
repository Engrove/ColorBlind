# Color data

The deploy build downloads `rgb_combined_v05.csv` from:

https://raw.githubusercontent.com/ayushoriginal/Optimized-RGB-To-ColorName/master/rgb_combined_v05.csv

Run this before local development if you want the full dataset locally:

```bash
npm run data:update
```

The sample CSV exists only so the app can still open in restricted/offline environments. The app tries the full local CSV first, then the upstream URL, then this sample file.
