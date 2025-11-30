import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import type { Sandbox } from "@vercel/sandbox";
import {
  createPR,
  createSandbox,
  editFile,
  listFiles,
  readFile,
} from "./sandbox.js";

export async function codingAgent(prompt: string, repoUrl?: string) {
  console.log("repoUrl:", repoUrl);
  let sandbox: Sandbox | undefined;

  try {
    const result = await generateText({
      model: "anthropic/claude-sonnet-4",
      prompt,
      providerOptions: {
        gateway: {
          order: ["bedrock", "anthropic"],
        },
      },
      system:
        "You are a coding agent. You will be working with js/ts projects. Your responses must be concise. If you make changes to the codebase, be sure to run the create_pr tool once you are done.",
      stopWhen: stepCountIs(10),
      tools: {
        read_file: tool({
          description:
            "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
          inputSchema: z.object({
            path: z
              .string()
              .describe("The relative path of a file in the working directory."),
          }),
          execute: async ({ path }) => {
            if (!repoUrl) {
              return { error: "A repoUrl is required to read files." };
            }
            try {
              if (!sandbox) sandbox = await createSandbox(repoUrl);
              const { content } = await readFile(sandbox, path);
              return { path, output: content };
            } catch (error) {
              console.error(`Error reading file at ${path}:`, error);
              return {
                path,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          },
        }),
        list_files: tool({
          description:
            "List files and directories at a given path. If no path is provided, lists files in the current directory.",
          inputSchema: z.object({
            path: z
              .string()
              .nullable()
              .describe(
                "Optional relative path to list files from. Defaults to current directory if not provided.",
              ),
          }),
          execute: async ({ path }) => {
            if (!repoUrl) {
              return { error: "A repoUrl is required to list files." };
            }
            const targetPath = path?.trim() || null;
            if (targetPath === ".git" || targetPath === "node_modules") {
              return { error: `You cannot read the path: ${targetPath}` };
            }

            try {
              if (!sandbox) sandbox = await createSandbox(repoUrl);
              const output = await listFiles(sandbox, targetPath);
              return { path: targetPath ?? ".", output };
            } catch (error) {
              console.error("Error listing files:", error);
              return { error };
            }
          },
        }),
        edit_file: tool({
          description:
            "Make edits to a text file. Replaces 'old_str' with 'new_str' in the given file. 'old_str' and 'new_str' MUST be different from each other. If the file specified with path doesn't exist, it will be created.",
          inputSchema: z.object({
            path: z.string().describe("The path to the file"),
            old_str: z
              .string()
              .describe(
                "Text to search for - must match exactly and must only have one match exactly",
              ),
            new_str: z.string().describe("Text to replace old_str with"),
          }),
          execute: async ({ path, old_str, new_str }) => {
            if (!repoUrl) {
              return { error: "A repoUrl is required to edit files." };
            }
            if (old_str === new_str) {
              return { error: "old_str and new_str must be different" };
            }
            try {
              if (!sandbox) sandbox = await createSandbox(repoUrl);
              const result = await editFile(sandbox, path, old_str, new_str);
              return result;
            } catch (error) {
              console.error(`Error editing file ${path}:`, error);
              return { error };
            }
          },
        }),
        create_pr: tool({
          description:
            "Create a pull request with the current changes. This will add all files, commit changes, push to a new branch, and create a PR using GitHub's REST API. Use this as the final step when making changes.",
          inputSchema: z.object({
            title: z.string().describe("The title of the pull request"),
            body: z.string().describe("The body/description of the pull request"),
            branch: z
              .string()
              .nullable()
              .describe(
                "The name of the branch to create (defaults to a generated name)",
              ),
          }),
          execute: async ({ title, body, branch }) => {
            if (!repoUrl) {
              return { error: "A repoUrl is required to create pull requests." };
            }
            try {
              if (!sandbox) sandbox = await createSandbox(repoUrl);
              const result = await createPR(sandbox, repoUrl, {
                title,
                body,
                branch,
              });
              return result;
            } catch (error) {
              console.error("Error creating PR:", error);
              return { error };
            }
          },
        }),
      },
    });

    return { response: result.text };
  } finally {
    if (sandbox) {
      await sandbox.stop();
    }
  }
}
