<!--
Copyright 2016 The AMP HTML Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS-IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Github Owners Bot

A web service that suggests approvers for a GitHub pull request based on OWNERS
files and enforces reviews by OWNERS as a GitHub status check.

## Getting Started

- Clone the github-owners-bot repository.
  `git clone git@github.com:google/github-owners-bot.git ${directory}`

- Clone the target repository to be evaluated.
  The github-owners-bot app requires a local copy of the target repository that
  we evaluate. You will need to set the `GITHUB_REPO_DIR` environment variable
  to the path of that target repository.
  ex. `git clone git@github.com:ampproject/amphtml.git ${target_directory}`

- Set the `REPO_DIR` environment variable to the `target_repository` path
  that was used in the step above.

- Set the `APP_ID` environment variable to your GitHub probot application.

- Set the `NODE_ENV` environment variable to "development".

- Set the `WEBHOOK_SECRET` environment variable to match what you set up
  on your GitHub Webhook pages.

- Install the `amp-owners-bot` GitHub on the remote target repository (This should
  be the same repository that you had closed for the local target repository)

- Go back into the `github-owners-bot` directory and run `yarn`.

- Run `npm run dev` to start the local server. You can also run `LOG_LEVEL=trace npm run dev`
  for maximum logging while developing the application.
