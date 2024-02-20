import { PlayerBreakBlockBeforeEvent, world } from "@minecraft/server"
import { Storage } from "../storages/storage"
import { getContainerFromEntity } from "../utils/get-container";
import { ItemState } from "../types/item-state";

export const example = async (eventData: PlayerBreakBlockBeforeEvent) => {
    // const beforeTime = new Date().getTime();

    // const results: Promise<boolean>[] = [];

    // for (let i = 0; i < 30; i++) {
    //     results.push(Storage.sendWriteTextRequest("helloworld", "a".repeat(1)));
    // }

    // const result = await Promise.all(results);

    // world.sendMessage(`results: ${result.join(", ")}`);

    // world.sendMessage(`runtime: ${new Date().getTime() - beforeTime}ms`);

    const { player } = eventData;
    const container = getContainerFromEntity(player);

    if (!container) return;

    const itemStates: ItemState[] = [];

    for (let i = 0; i < container.size; i++) {
        itemStates.push(container.getItem(i) ?? null);
    }

    await Storage.sendWriteItemsRequest("items", itemStates);
    const items = await Storage.sendReadItemsRequest("items");

    if (!items) return world.sendMessage("undefined");

    world.sendMessage(`${items.length}`);

}