/**
 * Contributor Service
 * Checks whether a GitHub user meets the minimum contribution requirements
 * configured for a repository before they can be assigned to an issue.
 *
 * How it works:
 *   1. Fetches all pull requests in the repo that are merged and authored by the user
 *   2. Counts them
 *   3. Compares against the min_contributions setting in .hiero-workflow.yml
 *
 * If min_contributions is 0, everyone qualifies (open to all).
 */

/**
 * Check if a contributor meets the minimum merged PR requirement.
 *
 * @param {import('probot').Context} context - Probot event context
 * @param {string} username - GitHub login to check
 * @param {number} minContributions - Minimum merged PRs required (0 = anyone qualifies)
 * @returns {Promise<boolean>} true if qualified, false if not
 */
async function checkContributorQualification(context, username, minContributions = 0) {
  // If the bar is 0, everyone qualifies immediately
  if (minContributions === 0) return true

  try {
    const { owner, repo } = context.repo()

    context.log.info(
      `Checking qualifications for ${username} in ${owner}/${repo} (min: ${minContributions} merged PRs)`
    )

    // Search for merged PRs authored by this user across the Hiero org
    // We search org-wide so contributors who have merged PRs in other Hiero
    // repos also qualify — this matches the spirit of "Hiero contributor"
    const { data: searchResult } = await context.octokit.search.issuesAndPullRequests({
      q: `org:hiero-ledger is:pr is:merged author:${username}`,
      per_page: minContributions + 1, // we only need to know if they hit the bar
    })

    const mergedCount = searchResult.total_count

    context.log.info(
      `${username} has ${mergedCount} merged PR(s) in hiero-ledger org`
    )

    return mergedCount >= minContributions
  } catch (err) {
    // If the API call fails, be permissive — don't block the contributor
    context.log.warn(`Could not check contributor qualifications: ${err.message}`)
    return true
  }
}

/**
 * Get a summary of a contributor's merged PRs in the Hiero org.
 * Useful for generating progression messages.
 *
 * @param {import('probot').Context} context
 * @param {string} username
 * @returns {Promise<{ total: number }>}
 */
async function getContributorStats(context, username) {
  try {
    const { data: searchResult } = await context.octokit.search.issuesAndPullRequests({
      q: `org:hiero-ledger is:pr is:merged author:${username}`,
      per_page: 1,
    })

    return { total: searchResult.total_count }
  } catch (err) {
    context.log.warn(`Could not fetch contributor stats: ${err.message}`)
    return { total: 0 }
  }
}

module.exports = { checkContributorQualification, getContributorStats }
