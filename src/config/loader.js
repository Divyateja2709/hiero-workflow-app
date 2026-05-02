/**
 * Config Loader
 * Reads the .hiero-workflow.yml file from the root of each repository.
 * If the file is missing, the bot does nothing for that repo.
 * This is the "opt-in" mechanism — repos without the config are ignored.
 */

/**
 * Load the .hiero-workflow.yml config from the repo that triggered the event.
 * Returns null if the file does not exist (bot should do nothing for this repo).
 *
 * @param {import('probot').Context} context - Probot event context
 * @returns {Promise<object|null>} Parsed config object or null
 */
async function loadConfig(context) {
  try {
    // Ask GitHub for the contents of .hiero-workflow.yml in this repo
    const response = await context.config('hiero-workflow.yml')

    if (!response) {
      context.log.info(
        `No .hiero-workflow.yml found in ${context.payload.repository?.full_name} — skipping`
      )
      return null
    }

    context.log.info(
      `Config loaded for ${context.payload.repository?.full_name}`
    )

    return response
  } catch (err) {
    // File missing or unreadable — treat as "not opted in"
    context.log.warn(`Could not load config: ${err.message}`)
    return null
  }
}

module.exports = { loadConfig }
