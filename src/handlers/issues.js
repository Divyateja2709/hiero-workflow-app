/**
 * Issue Handlers
 * Handles: new issues opened, issue comments (assignment requests), stale issues
 */

const { checkContributorQualification } = require('../services/contributor')

// ─── NEW ISSUE OPENED ────────────────────────────────────────────────────────

async function handleIssueOpened(context, config) {
  const issue = context.payload.issue
  const sender = context.payload.sender

  // Skip bot accounts
  if (sender.type === 'Bot') return

  context.log.info(`New issue opened: #${issue.number} by ${sender.login}`)

  // If onboarding is enabled, check if this is a first-time contributor
  if (config.onboarding?.enabled) {
    const isNew = await checkIfNewContributor(context, sender.login)

    if (isNew && config.onboarding.auto_assign_mentor) {
      await assignMentor(context, config, sender.login)
    }
  }
}

// ─── ISSUE COMMENT ───────────────────────────────────────────────────────────

async function handleIssueComment(context, config) {
  if (!config.issue_assignment?.enabled) return

  const comment = context.payload.comment.body
  const sender = context.payload.comment.user
  const issue = context.payload.issue

  // Skip bots
  if (sender.type === 'Bot') return

  // Skip comments on pull requests (they show up as issue_comment events too)
  if (context.payload.issue.pull_request) return

  const triggerPhrase = config.issue_assignment.trigger_phrase || 'I want to work on this'

  if (!comment.toLowerCase().includes(triggerPhrase.toLowerCase())) return

  context.log.info(`Assignment request from ${sender.login} on issue #${issue.number}`)

  // Check if issue is already assigned
  if (issue.assignees && issue.assignees.length > 0) {
    await context.octokit.issues.createComment(
      context.issue({
        body: `Hi @${sender.login} — this issue is already assigned. Please look for another open issue!`
      })
    )
    return
  }

  // Check contributor qualification if enabled
  if (config.issue_assignment.check_contributions) {
    const qualified = await checkContributorQualification(
      context,
      sender.login,
      config.issue_assignment.min_contributions
    )

    if (!qualified) {
      await context.octokit.issues.createComment(
        context.issue({
          body: [
            `Hi @${sender.login} — thanks for your interest!`,
            `To be assigned to issues, you need at least **${config.issue_assignment.min_contributions} merged contribution(s)** to the Hiero org first.`,
            ``,
            `Check out our [contributing guide](https://github.com/hiero-ledger/hiero/blob/main/CONTRIBUTING.md) to get started!`
          ].join('\n')
        })
      )
      return
    }
  }

  // Check if user already has too many assigned issues
  const { data: assignedIssues } = await context.octokit.issues.listForRepo({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    assignee: sender.login,
    state: 'open'
  })

  const max = config.issue_assignment.max_assigned_issues || 1
  if (assignedIssues.length >= max) {
    await context.octokit.issues.createComment(
      context.issue({
        body: `Hi @${sender.login} — you already have ${assignedIssues.length} open issue(s) assigned. Please complete those first!`
      })
    )
    return
  }

  // All checks passed — assign the issue
  await context.octokit.issues.addAssignees(
    context.issue({ assignees: [sender.login] })
  )

  await context.octokit.issues.createComment(
    context.issue({
      body: [
        `@${sender.login} — you've been assigned to this issue! Good luck!`,
        ``,
        `Please submit your PR within **14 days** or the issue may be unassigned.`
      ].join('\n')
    })
  )
}

// ─── STALE ISSUES ────────────────────────────────────────────────────────────

async function handleStaleIssues(context, config) {
  if (!config.stale?.enabled) return

  const { owner, repo } = context.repo()
  const daysBeforeStale = config.stale.days_before_stale || 30
  const daysBeforeClose = config.stale.days_before_close || 7
  const staleLabel = config.stale.stale_label || 'stale'
  const exemptLabels = config.stale.exempt_labels || []

  context.log.info(`Running stale check for ${owner}/${repo}`)

  const { data: issues } = await context.octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    per_page: 100
  })

  const now = new Date()

  for (const issue of issues) {
    const issueLabels = issue.labels.map(l => l.name)

    // Skip exempt labels — never mark these stale
    if (exemptLabels.some(label => issueLabels.includes(label))) continue

    const updatedAt = new Date(issue.updated_at)
    const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24)
    const isAlreadyStale = issueLabels.includes(staleLabel)

    if (isAlreadyStale && daysSinceUpdate >= daysBeforeStale + daysBeforeClose) {
      // Already stale and grace period has passed — close it
      await context.octokit.issues.update({
        owner, repo, issue_number: issue.number, state: 'closed'
      })
      await context.octokit.issues.createComment({
        owner, repo, issue_number: issue.number,
        body: `Closing this issue due to inactivity. Feel free to reopen if it's still relevant!`
      })
    } else if (!isAlreadyStale && daysSinceUpdate >= daysBeforeStale) {
      // Not yet stale but threshold reached — mark it
      await context.octokit.issues.addLabels({
        owner, repo, issue_number: issue.number, labels: [staleLabel]
      })
      await context.octokit.issues.createComment({
        owner, repo, issue_number: issue.number,
        body: `This issue has been inactive for ${daysBeforeStale} days and is marked as stale. It will be closed in ${daysBeforeClose} days if there's no activity.`
      })
    }
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function checkIfNewContributor(context, username) {
  try {
    const { owner, repo } = context.repo()
    const { data } = await context.octokit.repos.listContributors({ owner, repo })
    return !data.find(c => c.login === username)
  } catch {
    return true
  }
}

async function assignMentor(context, config, newUserLogin) {
  try {
    const { owner } = context.repo()
    const mentorTeam = config.onboarding.mentor_team || 'mentors'
    const { data: members } = await context.octokit.teams.listMembersInOrg({
      org: owner,
      team_slug: mentorTeam,
      per_page: 10
    })

    if (members.length > 0) {
      const mentor = members[Math.floor(Math.random() * members.length)]
      await context.octokit.issues.createComment(
        context.issue({
          body: `Welcome to Hiero! @${mentor.login} has been assigned as your mentor, @${newUserLogin}. Don't hesitate to reach out on [Discord](https://discord.gg/hiero)!`
        })
      )
    }
  } catch (err) {
    context.log.warn(`Could not assign mentor: ${err.message}`)
  }
}

module.exports = { handleIssueOpened, handleIssueComment, handleStaleIssues }
