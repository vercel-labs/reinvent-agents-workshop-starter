import crypto from "crypto";
import { WebClient } from "@slack/web-api";
import { codingAgent } from "../utils/agent.js";

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const processedEvents = new Set<string>();

function verifySlackRequest(body: string, timestamp: string, signature: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret || !timestamp || !signature) return false;

  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(baseString);
  const mySignature = `v0=${hmac.digest("hex")}`;

  if (mySignature.length !== signature.length) return false;

  return crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature));
}

function extractRepoUrl(text: string): string | null {
  const match = text.match(/https?:\/\/github\.com\/[\w-]+\/[\w.-]+/i);
  return match ? match[0].replace(/\.git$/, "") : null;
}

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
  const payload = JSON.parse(body);

  if (payload.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!verifySlackRequest(body, timestamp, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (payload.type === "event_callback" && payload.event?.type === "app_mention") {
    const eventId = payload.event_id || payload.event?.ts;
    if (processedEvents.has(eventId)) return new Response("OK");
    processedEvents.add(eventId);
    if (processedEvents.size > 1000) {
      const first = processedEvents.values().next().value;
      if (first) processedEvents.delete(first);
    }

    const { text, channel, thread_ts, ts } = payload.event;
    const threadTs = thread_ts || ts;
    const repoUrl = extractRepoUrl(text);
    const prompt = extractPrompt(text);

    if (!repoUrl) {
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: "Please include a GitHub repo URL. Example: `@bot add a readme https://github.com/owner/repo`",
      });
      return new Response("OK");
    }

    if (!prompt) {
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: "Please tell me what to do. Example: `@bot add a hello section https://github.com/owner/repo`",
      });
      return new Response("OK");
    }

    await slackClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: `Working on it... I'll create a PR for \`${repoUrl}\``,
    });

    try {
      const result = await codingAgent(prompt, repoUrl);
      const prUrlMatch = result.response?.match(/https:\/\/github\.com\/[\w-]+\/[\w.-]+\/pull\/\d+/);

      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: prUrlMatch
          ? `Done! Here's your PR: ${prUrlMatch[0]}`
          : `Done! ${result.response || "Changes have been made."}`,
      });
    } catch (error) {
      await slackClient.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `Something went wrong: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return new Response("OK");
  }

  return new Response("OK");
}

export async function GET() {
  return new Response("Slack endpoint is running", { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
