const PullRequest = require('./src/github').PullRequest;

module.exports = app => {
  app.on(['pull_request.opened'], pullRequest)

  async function pullRequest(context) {
    // Only allow PR's from our fork
    if (!/repos\/(erwinmombay|rsimha)/.test(context.payload.pull_request)) {
      return;
    }
    const pr = new PullRequest(context, context.payload.pull_request);
    await pr.processOpened();
  }
}
