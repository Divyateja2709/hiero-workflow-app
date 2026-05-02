/**
 * Hiero Workflow App
 * A GitHub App to automate maintainer workflows across all Hiero repositories.
 *
 * Each repo opts in by adding a .hiero-workflow.yml file to its root.
 * Repos without this file are completely ignored by the bot.
 */

const { loadConfig } = require('./config/loader')
const { handleIssueOpened, handleIssueComment, handleStaleIssues } = require('./handlers/issues')
const { handlePROpened, handlePRClosed } = require('./handlers/pullRequests')
const { handleNewContributor } = require('./handlers/onboarding')

/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.log.info('Hiero Workflow App is running!')

  // ─── ISSUE EVENTS ──────────────────────────────────────────────────────────

  // When a new issue is opened
  app.on('issues.opened', async (context) => {
    const config = await loadConfig(context)
    if (!config) return
    await handleIssueOpened(context, config)
  })

  // When someone comments on an issue (e.g. "I want to work on this")
  app.on('issue_comment.created', async (context) => {
    const config = await loadConfig(context)
    if (!config) return
    await handleIssueComment(context, config)
  })

  // ─── PULL REQUEST EVENTS ───────────────────────────────────────────────────

  // When a new PR is opened — run quality checks
  app.on('pull_request.opened', async (context) => {
    const config = await loadConfig(context)
    if (!config) return
    await handlePROpened(context, config)
  })

  // When a PR is merged — suggest the contributor's next issue
  app.on('pull_request.closed', async (context) => {
    const config = await loadConfig(context)
    if (!config) return
    await handlePRClosed(context, config)
  })

  // ─── MEMBER EVENTS ─────────────────────────────────────────────────────────

  // When someone new joins the org
  app.on('member.added', async (context) => {
    const config = await loadConfig(context)
    if (!config) return
    await handleNewContributor(context, config)
  })

  // ─── SCHEDULED STALE CHECK ─────────────────────────────────────────────────
  // The stale check is triggered by a GitHub Actions workflow on a cron schedule.
  // See .github/workflows/stale.yml in each repo that uses this feature.
  // When triggered via workflow_dispatch, this handler runs the stale logic.
  app.on('workflow_dispatch', async (context) => {
    const config = await loadConfig(context)
    if (!config) return
    if (config.stale?.enabled) {
      await handleStaleIssues(context, config)
    }
  })
}
