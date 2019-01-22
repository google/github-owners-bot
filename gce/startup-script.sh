#! /bin/bash
#   Copyright 2015-2016, Google, Inc.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# [START startup]
set -v

REPO="my/repo"
APP_DIR="/opt/app"
REPO_DIR="/opt/repo"
GITHUB_BOT_USERNAME="mybotsname"
SECRET_TOKEN="mysecrettoken"
CLOUD_BUCKET="gs://my-cloud-bucket"
GITHUB_ACCESS_TOKEN=""
OAUTH2_CLIENT_ID=""
OAUTH2_CLIENT_SECRET=""

# Talk to the metadata server to get the project id
PROJECTID=$(curl -s "http://metadata.google.internal/computeMetadata/v1/project/project-id" -H "Metadata-Flavor: Google")


# Install logging monitor. The monitor will automatically pick up logs sent to
# syslog.
# [START logging]
curl -s "https://storage.googleapis.com/signals-agents/logging/google-fluentd-install.sh" | bash
service google-fluentd restart &
# [END logging]

# Install dependencies from apt
apt-get update
apt-get install -yq ca-certificates git nodejs build-essential supervisor

# Install nodejs
mkdir /opt/nodejs
curl https://nodejs.org/dist/v6.9.1/node-v6.9.1-linux-x64.tar.gz | tar xvzf - -C /opt/nodejs --strip-components=1
ln -s /opt/nodejs/bin/node /usr/bin/node
ln -s /opt/nodejs/bin/npm /usr/bin/npm

# Get the application source code from the Google Cloud Repository.
# git requires $HOME and it's not set during the startup script.
export HOME=/root
git config --global credential.helper gcloud.sh
git clone https://source.developers.google.com/p/$PROJECTID "${APP_DIR}"

# Install app dependencies
cd "${APP_DIR}"
npm install
npm run start

git clone "https://github.com/${REPO}.git" "${REPO_DIR}"

# Create a nodeapp user. The application will run as this user.
useradd -m -d /home/nodeapp nodeapp
chown -R nodeapp:nodeapp "${APP_DIR}"
chown -R nodeapp:nodeapp "${REPO_DIR}"

# Configure supervisor to run the node app.
cat >/etc/supervisor/conf.d/node-app.conf << EOF
[program:nodeapp]
directory=${APP_DIR}
command=npm start
autostart=true
autorestart=true
user=nodeapp
environment=HOME="/home/nodeapp",USER="nodeapp",NODE_ENV="production",GCLOUD_PROJECT="${PROJECTID}",CLOUD_BUCKET="${CLOUD_BUCKET}",DATA_BACKEND="datastore",OAUTH2_CLIENT_ID="${OAUTH2_CLIENT_ID}",OAUTH2_CLIENT_SECRET="${OAUTH2_CLIENT_SECRET}",GITHUB_ACCESS_TOKEN="${GITHUB_ACCESS_TOKEN}",GITHUB_REPO_DIR="${REPO_DIR}",SECRET_TOKEN="${SECRET_TOKEN}",GITHUB_BOT_USERNAME="${GITHUB_BOT_USERNAME}"
stdout_logfile=syslog
stderr_logfile=syslog
EOF

supervisorctl reread
supervisorctl update

# Application should now be running under supervisor
# [END startup]
