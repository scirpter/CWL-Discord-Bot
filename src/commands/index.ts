import type { CommandModule } from "@/infra/discord/command-module.js";

import { configCommand } from "@/commands/config.js";
import { cwlCommand } from "@/commands/cwl.js";
import { playerCommand } from "@/commands/player.js";

export const commandModules: CommandModule[] = [playerCommand, cwlCommand, configCommand];
