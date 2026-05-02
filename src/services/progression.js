/**
 * Progression Service
 * After a contributor's PR is merged, suggest a meaningful next issue for them
 * to work on. This encourages continued engagement and helps contributors
 * progress toward becoming junior committers / committers / maintainers.
 *
 * How it works:
 *   1. Look for open, unassigned issues labeled "good first issue" in the same repo
 *   2. Exclude issues already assigned to someone
 *   3. Return the most recently updated one so suggestions stay fresh
 *   4. If no "good first issue" exists, fall back to "help wanted"
 */

/**
 * Find the best next issue to suggest to a contributor after their PR is merged.
 *
 * @param {import('probot').Context} context - Probot event context
 * @param {string} username - GitHub login of the contributor who just merged a PR
 * @returns {Promise<object|null>} GitHub issue object or null if nothing suitable found
 */
async function findNextIssue(context, username) {
  const { owner, repo } = context.repo()

  try {
    // First pass: try "good first issue" label
    let nextIssue = await findUnassignedIssueWithLabel(
      context,
      owner,
      repo,
      'good first issue',
      username
    )

    // Second pass: fall back to "help wanted" if nothing found
    if (!nextIssue) {
      nextIssue = await findUnassignedIssueWithLabel(
        context,
        owner,
        repo,
        'help wanted',
        username
      )
    }

    if (nextIssue) {
      context.log.info(
        `Suggesting issue #${nextIssue.number} to ${username} after PR merge`
      )
    } else {
      context.log.info(`No suitable next issue found for ${username}`)
    }

    return nextIssue
  } catch (err) {
    context.log.warn(`Could not find next issue: ${err.message}`)
    return null
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Find an open, unassigned issue with a specific label.
 * Excludes issues already assigned to the contributor.
 *
 * @param {import('probot').Context} context
 * @param {string} owner
 * @param {string} repo
 * @param {string} label
 * @param {string} excludeUser - Don't suggest issues already assigned to this user
 * @returns {Promise<object|null>}
 */
async function findUnassignedIssueWithLabel(context, owner, repo, label, excludeUser) {
  const { data: issues } = await context.octokit.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: label,
    sort: 'updated',
    direction: 'desc',
    per_page: 20,
  })

  // Filter to only unassigned issues (no one is working on them)
  const unassigned = issues.filter(
    (issue) =>
      !issue.pull_request && // exclude PRs that show up as issues
      issue.assignees.length === 0 // no one is assigned yet
  )

  return unassigned.length > 0 ? unassigned[0] : null
}

module.exports = { findNextIssue }
