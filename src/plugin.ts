import type { Plugin } from "@opencode-ai/plugin";

const plugin: Plugin = async () => ({
  "chat.headers": async (incoming, output) => {
    // Only inject for our own provider
    if (incoming.model.providerID !== "agy") return;

    // Pass the stable OpenCode session ID so agy can reuse conversations
    output.headers["x-agy-session-id"] = incoming.sessionID;
  },
});

export default plugin;
