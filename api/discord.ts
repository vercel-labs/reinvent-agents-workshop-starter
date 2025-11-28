// Discord integration for the coding agent

import crypto from "crypto";
import { codingAgent } from "../utils/agent";

// Verify the request is from Discord using the public key
function verifyDiscordRequest(
  body: string,
  signature: string,
  timestamp: string
): boolean {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;

  const message = timestamp + body;
  const signatureBuffer = Buffer.from(signature, "hex");
  const messageBuffer = Buffer.from(message);
  const publicKeyBuffer = Buffer.from(publicKey, "hex");

  try {
    return crypto.verify(
      null,
      messageBuffer,
      { key: publicKeyBuffer, format: "der", type: "spki" },
      signatureBuffer
    );
  } catch {
    return false;
  }
}

// Extract GitHub repo URL from message text
function extractRepoUrl(text: string): string | null {
  const githubRegex = /https?:\/\/github\.com\/[\w-]+\/[\w.-]+/i;
  const match = text.match(githubRegex);
  return match ? match[0].replace(/\.git$/, "") : null;
}

// Send a follow-up message to Discord
async function sendFollowup(token: string, content: string) {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  await fetch(
    `https://discord.com/api/v10/webhooks/${applicationId}/${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-signature-ed25519") || "";
  const timestamp = request.headers.get("x-signature-timestamp") || "";

  if (!verifyDiscordRequest(body, signature, timestamp)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body);

  // Handle Discord ping (verification)
  if (payload.type === 1) {
    return new Response(JSON.stringify({ type: 1 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Handle slash command or message
  if (payload.type === 2) {
    const options = payload.data.options || [];
    const promptOption = options.find((o: { name: string }) => o.name === "prompt");
    const repoOption = options.find((o: { name: string }) => o.name === "repo");

    const prompt = promptOption?.value;
    const repoUrl = repoOption?.value;

    if (!repoUrl || !extractRepoUrl(repoUrl)) {
      return new Response(
        JSON.stringify({
          type: 4,
          data: {
            content: "Please provide a valid GitHub repo URL. Example: `/code prompt:add a readme repo:https://github.com/owner/repo`",
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (!prompt) {
      return new Response(
        JSON.stringify({
          type: 4,
          data: {
            content: "Please tell me what you'd like me to do. Example: `/code prompt:add a contributing section repo:https://github.com/owner/repo`",
          },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Acknowledge with deferred response
    const token = payload.token;

    // Run agent in background and send follow-up
    (async () => {
      try {
        const result = await codingAgent(prompt, repoUrl);

        const prUrlMatch = result.response?.match(
          /https:\/\/github\.com\/[\w-]+\/[\w.-]+\/pull\/\d+/
        );

        if (prUrlMatch) {
          await sendFollowup(token, `Done! Here's your PR: ${prUrlMatch[0]}`);
        } else {
          await sendFollowup(token, `Done! ${result.response || "Changes have been made."}`);
        }
      } catch (error) {
        console.error("Error running coding agent:", error);
        await sendFollowup(
          token,
          `Something went wrong: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    })();

    // Return deferred response
    return new Response(
      JSON.stringify({
        type: 5,
        data: { content: `Working on it... I'll create a PR for \`${repoUrl}\`` },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ type: 1 }), {
    headers: { "Content-Type": "application/json" },
  });
}

