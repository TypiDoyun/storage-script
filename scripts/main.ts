import { world } from "@minecraft/server";
import { startStorage } from "./handlers/start-storage";
import { example } from "./handlers/example";

world.afterEvents.worldInitialize.subscribe(startStorage);

world.beforeEvents.playerBreakBlock.subscribe(example);