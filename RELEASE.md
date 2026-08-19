# Release Guide

## Steps to push a new release

```bash
# 1. Stage all changes
git add -A

# 2. Commit
git commit -m "fix: Instance Deletation, JSON issue"

# 3. Update package.json version (replace X.X.X with the new version)
npm version 1.0.14 --no-git-tag-version

# 4. Commit the version bump
git add package.json
git commit -m "chore: bump version to 1.0.14"

# 5. Tag and push (triggers GitHub Actions build + release)
git tag v1.0.14
git push origin main --tags
```

The `v*` tag triggers `.github/workflows/build.yml`, which builds `Flexo-Launcher-Setup-X.X.X.exe` and publishes it to the GitHub release automatically.
