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

A web server that lists down potential reviewers for a github pull request
using OWNER files in a repository.

## Deploying

This web server assumes it is running on Google Compute Engine (GCE).
A few Environment Variables need to be setup on the GCE start-up script.
(See gce/startup-script.sh)

- **GCLOUD_PROJECT** Google Cloud Project Id.
- **CLOUD_BUCKET**
- **OAUTH2_CLIENT_ID**
- **OAUTH2_CLIENT_SECRET**
- **GITHUB_ACCESS_TOKEN** The Authorization tokened used to make requests to
  github.
- **GITHUB_REPO_DIR** The directory path the clone of the repo is located.
- **GITHUB_USERNAME** The username of the bot.

## Disclaimer

This is not an official Google product.
