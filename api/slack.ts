// Slack integration for the coding agent

import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import { codingAgent } from "../utils/agent";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

// Verify the request is from Slack using the signing secret
function verifySlackRequest(
  body: string,
  timestamp: string,
  signature: string
): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(baseString);
  const mySignature = `v0=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}

// Extract GitHub repo URL from message text
function extractRepoUrl(text: string): string | null {
  const githubRegex = /https?:\/\/github\.com\/[\w-]+\/[\w.-]+/i;
  const match = text.match(githubRegex);
  return match ? match[0].replace(/\.git$/, "") : null;
}

// Extract the prompt by removing bot mentions and repo URLs
function extractPrompt(text: string): string {
  return text
    .replace(/<@[\w]+>/g, "")
    .replace(/https?:\/\/github\.com\/[\w-]+\/[\w.-]+/gi, "")
    .trim();
}

export async function POST(request: Request) {
  const body = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") || "";
  const signature = request.headers.get("x-slack-signature") || "";

  if (!verifySlackRequest(body, timestamp, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);

  // Handle Slack URL verification challenge
  if (payload.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle app mentions
  if (payload.type === "event_callback") {
    const event = payload.event;

    if (event.type === "app_mention") {
      const text = event.text;
      const channel = event.channel;
      const threadTs = event.thread_ts || event.ts;

      const repoUrl = extractRepoUrl(text);
      const prompt = extractPrompt(text);

      if (!repoUrl) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: "Please include a GitHub repo URL in your message. Example: `@bot add a readme to https://github.com/owner/repo`",
        });
        return new Response("OK");
      }

      if (!prompt) {
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: "Please tell me what you'd like me to do. Example: `@bot add a contributing section to the readme https://github.com/owner/repo`",
        });
        return new Response("OK");
      }

      // Acknowledge that we're working on it
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `Working on it... I'll create a PR for \`${repoUrl}\``,
      });

      try {
        const result = await codingAgent(prompt, repoUrl);

        // Extract PR URL from the agent response
        const prUrlMatch = result.response?.match(
          /https:\/\/github\.com\/[\w-]+\/[\w.-]+\/pull\/\d+/
        );

        if (prUrlMatch) {
          await slackClient.chat.postMessage({
            channel,
            thread_ts: threadTs,
            text: `Done! Here's your PR: ${prUrlMatch[0]}`,
          });
        } else {
          await slackClient.chat.postMessage({
            channel,
            thread_ts: threadTs,
            text: `Done! ${result.response || "Changes have been made."}`,
          });
        }
      } catch (error) {
        console.error("Error running coding agent:", error);
        await slackClient.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `Something went wrong: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      return new Response("OK");
    }
  }

  return new Response("OK");
}
