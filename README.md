# AI SDK Coding Agent

A coding agent built with AI SDK, Vercel AI Gateway, and Vercel Sandbox. It can read and modify GitHub repositories via API, Slack, or Discord.

## Setup

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Freinvent-agents-workshop-starter&project-name=reinvent-agents-workshop&repository-name=reinvent-agents-workshop)

1. Install the Vercel CLI: `npm i -g vercel`
2. Deploy this repo with the button above
3. Clone the new repo locally
4. Link to Vercel project: `vercel link`
5. Pull environment variables: `vercel env pull`
6. Install dependencies: `pnpm install`
7. Start dev server: `vercel dev`

## Environment Variables

### Required

- `GITHUB_TOKEN` - GitHub personal access token

### For Slack Integration

- `SLACK_BOT_TOKEN` - Bot User OAuth Token (starts with `xoxb-`)
- `SLACK_SIGNING_SECRET` - Signing secret from your Slack app

### For Discord Integration

- `DISCORD_APPLICATION_ID` - Application ID from Discord Developer Portal
- `DISCORD_PUBLIC_KEY` - Public key from your Discord app

## GitHub Personal Access Token

1. Go to https://github.com/settings/personal-access-tokens
2. Click "Generate new token"
3. Set repository access to "All repositories"
4. Add permissions:
   - Contents: Read and write
   - Pull requests: Read and write
5. Copy the token to your `.env.local` as `GITHUB_TOKEN`

## Slack App Setup

1. Go to https://api.slack.com/apps and create a new app
2. Under "OAuth & Permissions", add these Bot Token Scopes:
   - `app_mentions:read`
   - `chat:write`
3. Under "Event Subscriptions":
   - Enable events
   - Set Request URL to `https://your-deployment.vercel.app/api/slack`
   - Subscribe to `app_mention` event
4. Install the app to your workspace
5. Copy the Bot User OAuth Token to `SLACK_BOT_TOKEN`
6. Copy the Signing Secret to `SLACK_SIGNING_SECRET`

## Discord App Setup

1. Go to https://discord.com/developers/applications and create a new app
2. Copy the Application ID to `DISCORD_APPLICATION_ID`
3. Copy the Public Key to `DISCORD_PUBLIC_KEY`
4. Under "Bot", create a bot and copy the token if needed
5. Under "Installation", set the install link to use slash commands
6. Register a slash command named `/code` with options:
   - `prompt` (string, required): What you want the agent to do
   - `repo` (string, required): GitHub repository URL
7. Set the Interactions Endpoint URL to `https://your-deployment.vercel.app/api/discord`
8. Invite the bot to your server

## Usage

### API

```bash
curl -X POST https://your-deployment.vercel.app/api/agent \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "add a contributing section to the readme",
    "repoUrl": "https://github.com/owner/repo"
  }'
```

### Slack

Mention the bot in any channel:

```
@CodingBot add a contributing section to the readme https://github.com/owner/repo
```

The bot will reply in a thread with the PR link when done.

### Discord

Use the slash command:

```
/code prompt:add a contributing section to the readme repo:https://github.com/owner/repo
```

The bot will respond with the PR link when done.
