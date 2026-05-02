/**
 * Pull Request Handlers
 * Handles: PR opened (quality checks), PR merged (suggest next issue)
 */

const { findNextIssue } = require('../services/progression')

// ─── PR OPENED ───────────────────────────────────────────────────────────────

async function handlePROpened(context, config) {
  if (!config.pr_quality?.enabled) return

  const pr = context.payload.pull_request
  const sender = context.payload.sender

  if (sender.type === 'Bot') return

  context.log.info(`New PR #${pr.number} opened by ${sender.login}`)

  const issues = []

  // Check: has a meaningful description?
  if (config.pr_quality.require_description) {
    const bodyLength = (pr.body || '').trim().length
    if (bodyLength < (config.pr_quality.min_description_length || 50)) {
      issues.push('**Missing description** — please describe what this PR does and why.')
    }
  }

  // Check: is there a linked issue?
  if (config.pr_quality.require_linked_issue) {
    const body = pr.body || ''
    const hasLinkedIssue = /closes\s+#\d+|fixes\s+#\d+|resolves\s+#\d+/i.test(body)
    if (!hasLinkedIssue) {
      issues.push('**No linked issue** — please link the issue this PR resolves (e.g. `Closes #123`).')
    }
  }

  // Check: DCO sign-off on all commits?
  if (config.pr_quality.check_dco) {
    const { data: commits } = await context.octokit.pulls.listCommits({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      pull_number: pr.number
    })

    const missingDCO = commits.filter(c => {
      const msg = c.commit.message || ''
      return !msg.includes('Signed-off-by:')
    })

    if (missingDCO.length > 0) {
      issues.push(
        `**DCO sign-off missing** on ${missingDCO.length} commit(s). Run \`git commit --amend --signoff\` and force push.`
      )
    }
  }

  if (issues.length > 0) {
    const issueList = issues.map(i => `- ${i}`).join('\n')
    await context.octokit.issues.createComment(
      context.issue({
        body: [
          `Hi @${sender.login} — thanks for the PR! A few things need attention before review:`,
          ``,
          issueList,
          ``,
          `_This is an automated check by the Hiero Workflow App._`
        ].join('\n')
      })
    )

    // Add a label to flag it needs changes
    await context.octokit.issues.addLabels(
      context.issue({ labels: ['needs-changes'] })
    ).catch(() => {})
  } else {
    await context.octokit.issues.createComment(
      context.issue({
        body: `@${sender.login} — PR looks good on initial checks! A maintainer will review shortly.`
      })
    )
  }
}

// ─── PR CLOSED (MERGED) ──────────────────────────────────────────────────────

async function handlePRClosed(context, config) {
  const pr = context.payload.pull_request

  // Only act on merged PRs, not closed/abandoned ones
  if (!pr.merged) return
  if (!config.progression?.enabled) return
  if (!config.progression?.suggest_next_issue) return

  const sender = context.payload.sender
  if (sender.type === 'Bot') return

  context.log.info(`PR #${pr.number} merged by ${sender.login} — finding next issue`)

  const nextIssue = await findNextIssue(context, sender.login)

  if (nextIssue) {
    await context.octokit.issues.createComment(
      context.issue({
        body: [
          `Great work @${sender.login}! Your PR has been merged!`,
          ``,
          `Looking for something to work on next? Check out:`,
          `- [#${nextIssue.number} — ${nextIssue.title}](${nextIssue.html_url})`,
          ``,
          `Keep contributing and you'll be on track for a promotion!`
        ].join('\n')
      })
    )
  } else {
    const repoFullName = context.payload.repository.full_name
    await context.octokit.issues.createComment(
      context.issue({
        body: [
          `Great work @${sender.login}! Your PR has been merged!`,
          ``,
          `Check out our [open issues](https://github.com/${repoFullName}/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) for something new to work on.`
        ].join('\n')
      })
    )
  }
}

module.exports = { handlePROpened, handlePRClosed }
