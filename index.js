/**
 * Copyright 2019 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const {PullRequest, Teams} = require('./src/github');

module.exports = app => {
  app.on(['pull_request.opened', 'pull_request.synchronized'], onPullRequest)
  app.on('check_run.rerequested', onCheckRunRerequest)
  app.on('pull_request_review.submitted', onPullRequestReview);

  // Probot does not stream properly to GCE logs so we need to hook into
  // bunyan explicitly and stream it to process.stdout.
  app.log.target.addStream({
    name: 'app-custom-stream',
    stream: process.stdout,
    level: process.LOG_LEVEL || 'info',
  });

  async function processPullRequest(context, pullRequest) {
    const pr = new PullRequest(context, pullRequest);
    const teams = await new Teams(context).list();
    return await pr.processOpened();
  }

  async function onPullRequest(context) {
    return await processPullRequest(context, context.payload.pull_request);
  }

  async function onCheckRunRerequest(context) {
    const payload = context.payload;
    const pr = await PullRequest.get(context, payload.repository.owner.login,
      payload.repository.name, payload.check_run.check_suite.pull_requests[0].number);

    return await processPullRequest(context, pr.data);
  }

  async function onPullRequestReview(context) {
    const payload = context.payload;
    const pr = await PullRequest.get(context, payload.repository.owner.login,
      payload.repository.name, payload.pull_request.number);

    return await processPullRequest(context, pr.data);
  }
}
