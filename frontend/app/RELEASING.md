# Releasing the app

These are the steps to follow when releasing a new version of the app.

Make sure you are in the `frontend/app` directory, and replace `[version]` with the new version number in the following commands:

```bash
# switch to the main branch
git switch main

# pull the latest changes
git pull origin main

# make sure the app builds without errors
pnpm build

# update the app version number (no v prefix)
pnpm version [version]

# commit the version change
git add package.json
git commit -m "App: v[version]"

# created a signed tag for the new version
git tag -s @liquity2/app-v[version] -m '@liquity2/app-v[version]'

# push the version change and the new tag
git push origin main
git push origin @liquity2/app-v[version]
```

Now, create a new GitHub release with the new tag (`@liquity2/app-v[version]`). The release should include a summary of the changes in the new version, following the format used in previous releases if possible.
