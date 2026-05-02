# Hiero Workflow App

An early Probot-based GitHub App prototype for automating maintainer workflows across Hiero repositories.

This project was created as a proof of work for the **LFDT - Hiero GitHub Workflow App** mentorship. The goal is to explore how Hiero repositories can opt into configurable automation for onboarding contributors, assigning issues, checking pull request quality, handling stale work, and helping contributors progress.

## Current Status

This is an early prototype, not a production-ready application yet.

Tested so far:

- GitHub App created and installed on a test repository
- Local Probot server running successfully
- Smee webhook proxy forwarding GitHub events to localhost
- Repository config loaded successfully
- Issue assignment request detected from a comment
- Webhook events processed successfully with HTTP 200 responses

Example tested flow:

1. Install the GitHub App on a test repository.
2. Add the workflow config file.
3. Open or comment on an issue.
4. Comment `I want to work on this`.
5. The app loads config and runs the issue assignment workflow.

## What It Does

| Feature | Description | Status |
|---|---|---|
| Onboarding | Welcomes new contributors and assigns mentors from a configured GitHub team | Prototype |
| Issue Assignment | Assigns issues when contributors request them and checks contributor requirements | Tested locally |
| PR Quality | Checks for linked issues, meaningful descriptions, and DCO sign-off | Prototype |
| Stale Management | Marks inactive issues as stale and closes them after a grace period | Prototype |
| Progression | Suggests next issues after a pull request is merged | Prototype |
| AI Review | AI-assisted initial issue planning or pull request review | Planned |

## How It Works

Each repository opts into automation by adding a workflow config file. The app reads that config and only enables the workflows selected by that repository.

For the current Probot prototype, place the config at:

```text
.github/hiero-workflow.yml
```

Repositories without this config file are ignored by the app.

The sample config in this repository can be used as a starting point:

```text
.hiero-workflow.yml
```

## GitHub App Setup

Create a GitHub App from:

```text
GitHub -> Settings -> Developer settings -> GitHub Apps -> New GitHub App
```

Recommended local test settings:

| Field | Value |
|---|---|
| GitHub App name | `Hiero Workflow App Test` |
| Homepage URL | Your repository URL |
| Webhook URL | Your Smee channel URL |
| Webhook secret | A local secret value also stored in `.env` |
| Install target | Only your account, for testing |

Required repository permissions:

| Permission | Access | Why |
|---|---|---|
| Contents | Read-only | Read workflow config |
| Issues | Read and write | Comment, assign, label, and close issues |
| Pull requests | Read-only | Inspect pull requests and commits |
| Metadata | Read-only | Required by GitHub |

Recommended subscribed events:

- Issues
- Issue comment
- Pull request

Optional later events:

- Member
- Label
- Check suite
- Pull request review

## Local Development

Install dependencies:

```bash
npm install
```

Create your local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in `.env`:

```env
APP_ID=your_github_app_id
PRIVATE_KEY_PATH=./private-key.pem
WEBHOOK_SECRET=your_webhook_secret
WEBHOOK_PROXY_URL=https://smee.io/your-smee-channel
PORT=3000
NODE_ENV=development
```

Download the GitHub App private key and save it locally as:

```text
private-key.pem
```

Start the app:

```bash
npm start
```

If Smee is configured correctly, startup logs should include:

```text
Connected to https://smee.io/...
Forwarding https://smee.io/... to http://localhost:3000/api/github/webhooks
Listening on http://localhost:3000
```

## Testing With A Repository

1. Create a test repository.
2. Install the GitHub App on that repository.
3. Add this file to the test repository:

```text
.github/hiero-workflow.yml
```

4. Copy the sample config from this repository into that file.
5. Open a new issue.
6. Comment:

```text
I want to work on this
```

Expected local logs:

```text
Config loaded for owner/repo
Assignment request from username on issue #N
POST /api/github/webhooks 200
```

## Environment And Secret Safety

Never commit real secrets.

These files must stay local and are ignored by `.gitignore`:

```text
.env
private-key.pem
*.pem
node_modules/
```

Commit this file instead:

```text
.env.example
```

Before pushing, run:

```bash
git status
```

Make sure `.env` and `private-key.pem` are not listed.

## Project Structure

```text
src/
  index.js              # Main entry point and webhook event registration
  config/
    loader.js           # Loads repository workflow configuration
  handlers/
    issues.js           # Issue opened, issue comments, stale handling
    pullRequests.js     # PR quality checks and post-merge progression
    onboarding.js       # New contributor onboarding helpers
  services/
    contributor.js      # Contributor qualification checks
    progression.js      # Next issue suggestion logic
```

## Roadmap

- Add automated tests for handlers and services
- Add config schema validation
- Improve config loading and document supported config locations
- Add stronger security and permission boundary documentation
- Add team notification workflows based on labels
- Add production-ready stale scheduling
- Add AI-assisted issue planning and initial pull request review
- Pilot against one or more real Hiero repositories after maintainer feedback

## License

Apache-2.0
