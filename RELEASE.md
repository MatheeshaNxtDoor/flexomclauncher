# Release Guide

## Steps to push a new release

```bash
# 1. Stage all changes
git add -A

# 2. Commit
git commit -m "fix: mod loader launch, instance versionId, remove version history UI"

# 3. Update package.json version (replace X.X.X with the new version)
npm version X.X.X --no-git-tag-version

# 4. Commit the version bump
git add package.json
git commit -m "chore: bump version to X.X.X"

# 5. Tag and push (triggers GitHub Actions build + release)
git tag vX.X.X
git push origin main --tags
```

The `v*` tag triggers `.github/workflows/build.yml`, which builds `Flexo-Launcher-Setup-X.X.X.exe` and publishes it to the GitHub release automatically.
