import { system, world } from "@minecraft/server";
import { Storage } from "../storages/storage"

export const startStorage = () => {
    const size = 2;

    for (let x = -size; x <= size; x++) {
        for (let z = -size; z <= size; z++) {
            Storage.addWorkspace({ x, y: -61, z });
        }
    }
    // Storage.addWorkspace({ x: 1, y: -61, z: 1 });
    // Storage.addWorkspace({ x: -1, y: -61, z: 0 });
    // Storage.addWorkspace({ x: 0, y: -61, z: 1 });
    // Storage.addWorkspace({ x: 0, y: -61, z: -1 });

    let intervalId: number;

    const start = async () => {
        const result = await Storage.start();
        if (result) system.clearRun(intervalId);
    }
    start();

    intervalId = system.runInterval(start, 10);

}