const PullRequest = require('./src/github').PullRequest;

module.exports = app => {
  app.on(['pull_request.opened', 'pull_request.synchronized'], onPullRequest)
  app.on(['check_run.rerequested'], onCheckRunRerequest)

  async function onPullRequest(context) {
    context.log.debug('IM HERE aaaa');
    // Only allow PR's from our fork
    const disallowed = !/repos\/(erwinmombay|rsimha)/.test(context.payload.pull_request.url);
    context.log.debug('[disallowed?]', disallowed, context.payload.pull_request.url);
    if (disallowed) {
      return;
    }
    return await processPullRequest(context, context.payload.pull_request);
  }

  async function onCheckRunRerequest(context) {
    const payload = context.payload;
    context.log.debug('IM HERE bbb', payload);
    const pr = await PullRequest.get(context, payload.repository.owner.login,
      payload.repository.name, payload.check_run.check_suite.pull_requests[0].number);

    return await processPullRequest(context, pr.data);
  }

  async function processPullRequest(context, pullRequest) {
    const pr = new PullRequest(context, pullRequest);
    return await pr.processOpened();
  }
}
