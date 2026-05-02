# Hiero Workflow App

A GitHub App that automates end-to-end maintainer workflows across all Hiero repositories.

## What It Does

| Feature | Description |
|---|---|
| 🤝 Onboarding | Welcomes new contributors, assigns mentors |
| 📋 Issue Assignment | Auto-assigns issues when contributors request them, checks qualifications |
| ✅ PR Quality | Checks DCO sign-off, description, linked issue |
| 🧹 Stale Management | Marks and closes stale issues/PRs automatically |
| 🚀 Progression | Suggests next issues after a merged PR |
| 🤖 AI Review | *(coming soon)* AI-assisted initial PR review |

## How It Works

Each repo opts in by adding a `.hiero-workflow.yml` file to its root. The bot reads this config and applies only the features that repo has enabled. **Repos without the config file are completely ignored.**

## Setup for a New Repo

1. Copy `.hiero-workflow.yml` to your repo root
2. Edit it to enable/disable the features you want
3. That's it — the bot handles the rest

## Local Development

```bash
npm install
cp .env.example .env
# Fill in your GitHub App credentials in .env
npm run dev
```

## Project Structure

```
src/
  index.js              # Main entry point - registers all event listeners
  config/
    loader.js           # Reads .hiero-workflow.yml from each repo
  handlers/
    issues.js           # Issue opened, comment, stale
    pullRequests.js     # PR opened (quality check), PR merged (progression)
    onboarding.js       # New contributor welcome
  services/
    contributor.js      # Checks contributor qualifications
    progression.js      # Finds next issue to suggest
```

## License

Apache-2.0 — Linux Foundation
