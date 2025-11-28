import { codingAgent } from "./agent";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

codingAgent(
  "Tell me how this agent currently works.",
  "https://github.com/dancer/reinvent-nextjs-playground",
)
  .then(console.log)
  .catch(console.error);