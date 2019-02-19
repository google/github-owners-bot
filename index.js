const PullRequest = require('./src/github').PullRequest;

module.exports = app => {
  app.on(['pull_request.opened'], pullRequest)

  async function pullRequest(context) {
    // Only allow PR's from our fork
    const disallowed = !/repos\/(erwinmombay|rsimha)/.test(context.payload.pull_request.url);
    context.log.debug('[disallowed?]', disallowed, context.payload.pull_request.url);
    if (disallowed) {
      return;
    }
    const pr = new PullRequest(context, context.payload.pull_request);
    return await pr.processOpened();
  }
}
