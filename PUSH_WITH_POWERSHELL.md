# Push updated ColorBlind to GitHub with PowerShell

This package contains the colorblind assist update prepared in Workbench.

## What changed

- Fixed the colorblind assist panel mount point for the current `.sheet` layout.
- Added selectable assist modes: standard, red-green assist, protan, deutan, tritan and monochrome/contrast.
- Added live camera preview filters for each assist mode.
- Kept text interpretation as the safer output: use-as family, likely confusion group, standard color and family.
- Reduced camera sampling interval from 420 ms to 220 ms for more responsive feedback.
- Normalized `package.json` and `package-lock.json` to UTF-8 without BOM so the project scripts run reliably.

## Verified in Workbench

```text
npm run check
STATUS:0
```

## PowerShell push flow

Run this from a local folder where you want to work:

```powershell
$RepoUrl = "https://github.com/Engrove/ColorBlind.git"
$Branch = "colorblind-assist"
$ZipPath = "C:\\Path\\To\\ColorBlind-colorblind-assist.zip"
$Work = "$env:TEMP\\ColorBlind-push"
$Extract = "$env:TEMP\\ColorBlind-updated"

Remove-Item -Recurse -Force $Work -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $Extract -ErrorAction SilentlyContinue

git clone $RepoUrl $Work
Set-Location $Work
git checkout -b $Branch

Expand-Archive -LiteralPath $ZipPath -DestinationPath $Extract -Force
Copy-Item -Path "$Extract\\ColorBlind-main\\*" -Destination $Work -Recurse -Force

git status
git add public/app.js public/styles.css README.md package.json package-lock.json PUSH_WITH_POWERSHELL.md
git commit -m "Add colorblind assist modes"
git push -u origin $Branch
```

Then open GitHub and create a pull request from `colorblind-assist` to `main`.

If you want to push directly to `main`, replace `git checkout -b $Branch` with `git checkout main`, then run `git pull` before copying files. Branch + pull request is safer.
