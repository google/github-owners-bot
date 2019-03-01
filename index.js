const PullRequest = require('./src/github').PullRequest;

module.exports = app => {
  app.on(['pull_request.opened', 'pull_request.synchronized'], onPullRequest)
  app.on('check_run.rerequested', onCheckRunRerequest)
  app.on('pull_request_review.submitted', onPullRequestReview);

  async function onPullRequest(context) {
    return await processPullRequest(context, context.payload.pull_request);
  }

  async function onCheckRunRerequest(context) {
    const payload = context.payload;
    const pr = await PullRequest.get(context, payload.repository.owner.login,
      payload.repository.name, payload.check_run.check_suite.pull_requests[0].number);

    return await processPullRequest(context, pr.data);
  }

  async function processPullRequest(context, pullRequest) {
    const pr = new PullRequest(context, pullRequest);
    return await pr.processOpened();
  }

  async function onPullRequestReview(context) {
    const payload = context.payload;
    const pr = await PullRequest.get(context, payload.repository.owner.login,
      payload.repository.name, payload.pull_request.number);

    return await processPullRequest(context, pr.data);
  }
}
