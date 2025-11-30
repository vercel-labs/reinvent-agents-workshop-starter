import { codingAgent } from "./agent.js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

codingAgent(
  "Tell me how this agent currently works.",
  "https://github.com/dancer/reinvent-workshop-companion",
)
  .then(console.log)
  .catch(console.error);