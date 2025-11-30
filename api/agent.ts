import { codingAgent } from "../utils/agent.js";

export async function POST(request: Request) {
  const body = await request.json();
  const { prompt, repoUrl } = body as {
    prompt?: string;
    repoUrl?: string;
  };

  if (!prompt || typeof prompt !== "string") {
    return new Response(JSON.stringify({ error: "prompt is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!repoUrl || typeof repoUrl !== "string") {
    return new Response(JSON.stringify({ error: "repoUrl is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await codingAgent(prompt, repoUrl);
    return new Response(JSON.stringify({ result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
