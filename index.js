const PullRequest = require('./src/github').PullRequest;

module.exports = app => {
  app.on(['pull_request.opened'], pullRequest)

  async function pullRequest(context) {
    const pr = new PullRequest(context, context.payload.pull_request);
    await pr.processOpened();
  }
}
