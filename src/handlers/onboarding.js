/**
 * Onboarding Handler
 * Handles: new members joining the org, first-time contributors
 * 
 * When a new member is added to the org or a first-time contributor opens
 * an issue/PR, this handler:
 *   1. Posts a welcome message
 *   2. Assigns a mentor from the configured mentor team (if enabled)
 *   3. Flags bot accounts if human_check is enabled
 */

/**
 * Handle a new member being added to the GitHub org.
 *
 * @param {import('probot').Context} context
 * @param {object} config - Parsed .hiero-workflow.yml config
 */
async function handleNewContributor(context, config) {
  if (!config.onboarding?.enabled) return

  const member = context.payload.member
  if (!member) return

  // Human check — skip bots
  if (config.onboarding.human_check && member.type === 'Bot') {
    context.log.info(`Skipping bot account: ${member.login}`)
    return
  }

  context.log.info(`New member joined: ${member.login}`)

  // If auto mentor assignment is on, pick a mentor from the team
  if (config.onboarding.auto_assign_mentor) {
    await assignMentorToNewMember(context, config, member.login)
  }
}

/**
 * Welcome a first-time contributor on their first issue or PR.
 * Call this from issue/PR handlers when you detect a first-time contributor.
 *
 * @param {import('probot').Context} context
 * @param {object} config
 * @param {string} username - GitHub login of the new contributor
 */
async function welcomeFirstTimeContributor(context, config, username) {
  if (!config.onboarding?.enabled) return

  const welcomeMessage = [
    `👋 Welcome to Hiero, @${username}! We're glad you're here.`,
    ``,
    `Here are some resources to help you get started:`,
    `- 📖 [Contributing Guide](https://github.com/hiero-ledger/hiero/blob/main/CONTRIBUTING.md)`,
    `- 💬 [Discord Community](https://discord.gg/hiero) — join **#hiero-general** to say hi`,
    `- 📅 [Community Meetings](https://hiero.org/calendar) — open to all contributors`,
    ``,
    `If you have any questions, don't hesitate to ask. Happy contributing! 🚀`,
  ].join('\n')

  await context.octokit.issues.createComment(
    context.issue({ body: welcomeMessage })
  )

  // Optionally assign a mentor
  if (config.onboarding.auto_assign_mentor) {
    await assignMentorViaComment(context, config, username)
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Picks a mentor from the configured GitHub team and posts a comment tagging them.
 */
async function assignMentorViaComment(context, config, newUserLogin) {
  try {
    const { owner } = context.repo()
    const mentorTeam = config.onboarding.mentor_team || 'mentors'

    const { data: members } = await context.octokit.teams.listMembersInOrg({
      org: owner,
      team_slug: mentorTeam,
      per_page: 10,
    })

    if (members.length === 0) {
      context.log.warn(`No members found in mentor team: ${mentorTeam}`)
      return
    }

    // Pick a random mentor to spread the load
    const mentor = members[Math.floor(Math.random() * members.length)]

    await context.octokit.issues.createComment(
      context.issue({
        body: `🎓 @${mentor.login} has been assigned as your mentor, @${newUserLogin}! Feel free to reach out with any questions on [Discord](https://discord.gg/hiero).`,
      })
    )

    context.log.info(`Assigned mentor ${mentor.login} to ${newUserLogin}`)
  } catch (err) {
    context.log.warn(`Could not assign mentor: ${err.message}`)
  }
}

/**
 * For org member.added events (no issue context), just logs the assignment.
 */
async function assignMentorToNewMember(context, config, newUserLogin) {
  try {
    const { owner } = context.repo()
    const mentorTeam = config.onboarding.mentor_team || 'mentors'

    const { data: members } = await context.octokit.teams.listMembersInOrg({
      org: owner,
      team_slug: mentorTeam,
      per_page: 10,
    })

    if (members.length === 0) return

    const mentor = members[Math.floor(Math.random() * members.length)]
    context.log.info(
      `New member ${newUserLogin} — suggested mentor: ${mentor.login}`
    )
  } catch (err) {
    context.log.warn(`Could not assign mentor for new member: ${err.message}`)
  }
}

module.exports = {
  handleNewContributor,
  welcomeFirstTimeContributor,
}
