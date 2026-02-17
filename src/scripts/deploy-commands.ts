import { REST, Routes } from "discord.js";

import { loadEnv } from "@/config/env.js";
import { commandModules } from "@/commands/index.js";

async function deployCommands() {
  const env = loadEnv();
  const body = commandModules.map((module) => module.data.toJSON());
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const deployGuildId = process.env.DEPLOY_GUILD_ID;

  if (deployGuildId) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, deployGuildId), {
      body
    });
    process.stdout.write(`Deployed ${body.length} commands to guild ${deployGuildId}.\n`);
    return;
  }

  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body
  });
  process.stdout.write(`Deployed ${body.length} global commands.\n`);
}

void deployCommands();
