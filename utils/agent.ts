import { generateText, stepCountIs, tool } from "ai";
import z from "zod/v4";
import fs from "fs";

export async function codingAgent(prompt: string) {
  const result = await generateText({
    model: "anthropic/claude-sonnet-4",
    providerOptions: {
      gateway: {
        order: ["bedrock", "anthropic"],
      },
    },
    prompt,
    system:
      "You are a coding agent. You will be working with js/ts projects. Your responses must be concise.",
    stopWhen: stepCountIs(10),
    tools: {
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
        execute: async ({ path: generatedPath }) => {
          if (generatedPath === ".git" || generatedPath === "node_modules") {
            return { error: "You cannot read the path: ", generatedPath };
          }
          const path = generatedPath?.trim() ? generatedPath : ".";
          try {
            console.log(`Listing files at '${path}'`);
            const output = fs.readdirSync(path, {
              recursive: false,
            });
            return { path, output };
          } catch (e) {
            console.error(`Error listing files:`, e);
            return { error: e };
          }
        },
      }),
      read_file: tool({
        description:
          "Read the contents of a given relative file path. Use this when you want to see what's inside a file. Do not use this with directory names.",
        inputSchema: z.object({
          path: z
            .string()
            .describe("The relative path of a file in the working directory."),
        }),
        execute: async ({ path }) => {
          try {
            console.log(`Reading file at '${path}'`);
            const output = fs.readFileSync(path, "utf-8");
            return { path, output };
          } catch (error) {
            console.error(`Error reading file at ${path}:`, error instanceof Error ? error.message : String(error));
            return { path, error: error instanceof Error ? error.message : String(error) };
          }
        },
      }),
      edit_file: tool({ 
        description:
          "Make edits to a text file or create a new file. Replaces 'old_str' with 'new_str' in the given file. 'old_str' and 'new_str' MUST be different from each other. If the file specified with path doesn't exist, it will be created.", 
          inputSchema: z.object({ 
            path: z.string().describe("The path to the file"), 
            old_str: z 
              .string() 
              .nullable() 
              .describe( 
                "Text to search for - must match exactly and must only have one match exactly", 
              ), 
            new_str: z.string().describe("Text to replace old_str with"), 
          }), 
          execute: async ({ path, old_str, new_str }) => { 
            try { 
              const fileExists = fs.existsSync(path); 
              if (fileExists && old_str !== null) { 
                console.log(`Editing file '${path}'`); 
                const fileContents = fs.readFileSync(path, "utf-8"); 
                const newContents = fileContents.replace(old_str, new_str); 
                fs.writeFileSync(path, newContents); 
                return { path, success: true, action: "edit" }; 
              } else { 
                console.log(`Creating file '${path}'`); 
                fs.writeFileSync(path, new_str); 
                return { path, success: true, action: "create" }; 
              } 
            } catch (e) { 
              console.error(`Error editing file ${path}:`, e); 
              return { error: e, success: false }; 
            } 
          }, 
      }), 
    },
  });

  return {
    response: result.text,
  };
}