import { Block, Container, DimensionLocation, ItemStack, system, world } from "@minecraft/server";
import { Location } from "../types/location";
import { isLocationEquals } from "../utils/equals";
import { StorageRequest } from "../types/storage-request";
import { ItemState } from "../types/item-state";
import { getContainerFromBlock } from "../utils/get-container";
import { Context, ContextType } from "../types/context";

export namespace Storage {
    const textIdentifier = "typi-storage";
    const itemIdentifier = "typi-item-storage";
    const overworld = world.getDimension("overworld");
    const workspaces: Location[] = [];
    const requestQueues: StorageRequest[][] = [];
    const isProcessing: boolean[] = [];
    const workspaceBlocks: Block[] = [];

    const NAME_MAX_STORAGE_SIZE = 255;
    const LORE_MAX_STORAGE_SIZE = 1000; // 20 * 50
    const SLOT_MAX_STORAGE_SIZE = 1255; // 255 + 20 * 50
    const CONTAINER_MAX_STORAGE_SIZE = 33_885; // (255 + 20 * 50) * 27

    let isStarted = false;

    export const addWorkspace = (workspace: Location) => {
        if (isStarted) return;

        const exists = workspaces.some(element => isLocationEquals(element, workspace));

        if (exists) throw new Error("Workspace already exists");

        workspaces.push(workspace);
        requestQueues.push([]);
        isProcessing.push(false);
    }

    export const start = async () => {
        const workspaceMinX = Math.min(...workspaces.map(workspace => workspace.x));
        const workspaceMaxX = Math.max(...workspaces.map(workspace => workspace.x));
        const workspaceMinZ = Math.min(...workspaces.map(workspace => workspace.z));
        const workspaceMaxZ = Math.max(...workspaces.map(workspace => workspace.z));

        await overworld.runCommandAsync(`tickingarea remove "${textIdentifier}"`);
        const commandResult = await overworld.runCommandAsync(`tickingarea add ${workspaceMinX} 0 ${workspaceMinZ} ${workspaceMaxX} 0 ${workspaceMaxZ} "${textIdentifier}"`);

        for (const workspace of workspaces) {
            const block = overworld.getBlock(workspace);

            if (!block) return false;

            workspaceBlocks.push(block);
        }

        if (commandResult.successCount !== 0) isStarted = true;

        return true;
    }

    export const sendWriteTextRequest = (id: string, text: string) => {
        return new Promise<boolean>((onEnd, onError) => {
            sendRequest({
                method: "write",
                id,
                dataType: "text",
                text,
                onEnd
            });
        })
    }
    
    export const sendReadTextRequest = (id: string) => {
        return new Promise<string | undefined>((onEnd, onError) => {
            sendRequest({
                method: "read",
                id,
                dataType: "text",
                onEnd
            });
        })
    }
    
    export const sendDeleteTextRequest = (id: string) => {
        return new Promise<boolean>((onEnd, onError) => {
            sendRequest({
                method: "delete",
                id,
                dataType: "text",
                onEnd
            });
        })
    }


    export const sendWriteItemsRequest = (id: string, itemStates: ItemState[]) => {
        return new Promise<boolean>((onEnd, onError) => {
            sendRequest({
                method: "write",
                id,
                dataType: "item",
                itemStates,
                onEnd
            });
        })
    }
    
    export const sendReadItemsRequest = (id: string) => {
        return new Promise<ItemState[] | undefined>((onEnd, onError) => {
            sendRequest({
                method: "read",
                id,
                dataType: "item",
                onEnd
            });
        });
    }

    export const sendDeleteItemRequest = (id: string) => {
        return new Promise<boolean>((onEnd, onError) => {
            sendRequest({
                method: "delete",
                id,
                dataType: "item",
                onEnd
            });
        })
    }

    const sendWriteTextContextRequest = (context: Context) => {
        return new Promise<boolean>((onEnd, onError) => {
            sendRequest({
                method: "write",
                dataType: "textContext",
                context,
                onEnd
            });
        });
    }

    export const sendReadTextContextRequest = () => {
        return new Promise<Context>((onEnd, onError) => {
            sendRequest({
                method: "read",
                dataType: "textContext",
                onEnd
            });
        });
    }

    const sendWriteItemContextRequest = (context: Context) => {
        return new Promise<boolean>((onEnd, onError) => {
            sendRequest({
                method: "write",
                dataType: "itemContext",
                context,
                onEnd
            });
        });
    }

    export const sendReadItemContextRequest = () => {
        return new Promise<Context>((onEnd, onError) => {
            sendRequest({
                method: "read",
                dataType: "itemContext",
                onEnd
            });
        });
    }

    const writeText = (id: string, text: string, workspaceBlock: Block, contextMode: boolean = false) => {
        return new Promise<boolean>((resolve, reject) => {
            system.run(async () => {
                if (!isStarted) return resolve(false);

                workspaceBlock.setType("minecraft:chest");

                const container = getContainerFromBlock(workspaceBlock);

                if (!container) return resolve(false);

                let containerIndex = -1;
                let length = 0;

                while (true) {
                    containerIndex++;

                    if (containerIndex < text.length / CONTAINER_MAX_STORAGE_SIZE) {
                        container.clearAll();
    
                        let containerText = text.slice(CONTAINER_MAX_STORAGE_SIZE * containerIndex, CONTAINER_MAX_STORAGE_SIZE * (containerIndex + 1));
                        
                        for (let slotIndex = 0; slotIndex < containerText.length / SLOT_MAX_STORAGE_SIZE; slotIndex++) {
    
                            let slotText = containerText.slice(SLOT_MAX_STORAGE_SIZE * slotIndex, SLOT_MAX_STORAGE_SIZE * (slotIndex + 1));
                            const itemStack = new ItemStack("minecraft:paper", 1);
    
                            itemStack.nameTag = slotText.slice(0, NAME_MAX_STORAGE_SIZE);
                            
                            let loreText = slotText.slice(NAME_MAX_STORAGE_SIZE);
                            const lore: string[] = [];
    
                            for (let loreIndex = 0; loreIndex < loreText.length / 50; loreIndex++) {
                                lore.push(loreText.slice(50 * loreIndex, 50 * (loreIndex + 1)));
                            }
    
                            itemStack.setLore(lore);
                            container.setItem(slotIndex, itemStack);
                        }
                        await overworld.runCommandAsync(`structure save "${id}-${containerIndex}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z} ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z} false disk true`);
                        length = containerIndex + 1;
                    }
                    else {
                        const commandResult = await overworld.runCommandAsync(`structure delete "${id}-${containerIndex}"`);

                        if (commandResult.successCount === 0) break;
                    }
                }

                
                if (!contextMode) await addContext("text", id, length, workspaceBlock);
                else container.clearAll();

                resolve(true);
            });
        });
    }

    const readText = (id: string, workspaceBlock: Block, contextMode: boolean = false) => {
        return new Promise<string | undefined>((resolve, reject) => {
            system.run(async () => {
                if (!isStarted) return resolve(undefined);
                
                let readComplete = false;
                let containerIndex = 0;
                let result = "";
                let container: Container | undefined;

                while (true) {
                    const commandResult = await overworld.runCommandAsync(`structure load "${id}-${containerIndex}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z}`);
                    if (commandResult.successCount === 0) break;

                    container = getContainerFromBlock(workspaceBlock);
                    if (!container) return resolve(undefined);

                    readComplete = true;

                    for (let slotIndex = 0; slotIndex < container.size; slotIndex++) {
                        const itemStack = container.getItem(slotIndex);

                        if (!itemStack) continue;

                        result += itemStack.nameTag;
                        result += itemStack.getLore().join("");
                    }

                    containerIndex++;
                }

                container?.clearAll();
                resolve(readComplete ? result : undefined);
            });
        });
    }

    const deleteId = async (type: ContextType, id: string, workspaceBlock: Block) => {
        if (!isStarted) return false;

        let deleteComplete = false;
        let containerIndex = 0;

        while (true) {
            const commandResult = await overworld.runCommandAsync(`structure delete "${id}-${containerIndex}"`);
            if (commandResult.successCount === 0) break;

            deleteComplete = true;
            containerIndex++;
        }

        return deleteComplete && removeContext(type, id, workspaceBlock);
    }

    const writeItems = (id: string, itemStates: ItemState[], workspaceBlock: Block) => {
        return new Promise<boolean>((resolve, reject) => {
            system.run(async () => {
                if (!isStarted) return resolve(false);
                
                const chestContainer = getContainerFromBlock(workspaceBlock);

                world.sendMessage(`processor id: ${workspaceBlocks.indexOf(workspaceBlock)}`)

                if (!chestContainer) return resolve(false);

                let index = -1;
                let containerLength = 0;

                while (true) {
                    index++;

                    world.sendMessage(`index: ${index}; still running`)

                    if (index < itemStates.length / chestContainer.size) {
                        chestContainer.clearAll();

                        for (let slotId = 0; slotId < chestContainer.size; slotId++) {
                            let sourceIndex = index * chestContainer.size + slotId;
                            
                            if (sourceIndex >= itemStates.length) break;
    
                            const sourceItem = itemStates[sourceIndex];
    
                            if (!sourceItem) continue;
    
                            chestContainer.setItem(slotId, sourceItem);
                        }

                        await overworld.runCommandAsync(`structure save "${id}-${index}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z} ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z} false disk true`);

                        containerLength = index + 1;
                    }
                    else {
                        const commandResult = await overworld.runCommandAsync(`structure delete "${id}-${index}"`);

                        if (commandResult.successCount === 0) break;
                    }
                }

                await addContext("item", id, containerLength, workspaceBlock);

                return resolve(true);
            });
        });
    }

    const readItems = (id: string, workspaceBlock: Block) => {
        return new Promise<ItemState[] | undefined>((resolve, reject) => {
            system.run(async () => {
                if (!isStarted) return resolve(undefined);

                let readComplete = false;
                let index = 0;

                const items: ItemState[] = [];

                while (true) {
                    const commandResult = await overworld.runCommandAsync(`structure load "${id}-${index}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z}`);
                    if (commandResult.successCount === 0) break;

                    readComplete = true;

                    const container = getContainerFromBlock(workspaceBlock);

                    if (!container) return resolve(undefined);

                    for (let slotId = 0; slotId < container.size; slotId++) {
                        const itemStack = container.getItem(slotId);

                        items.push(itemStack ? itemStack : null);
                    }

                    index++;
                }

                return resolve(readComplete ? items : undefined);
            });
        });
    }
    
    const writeContext = async (type: ContextType, context: Context, workspaceBlock: Block) => {
        const contextString = JSON.stringify(context);
        const identifier = type === "text" ? textIdentifier : itemIdentifier;

        return await writeText(`${identifier}-context:context`, contextString, workspaceBlock, true);
    }

    const readContext = async (type: ContextType, workspaceBlock: Block) => {
        let textContext: Context;
        const identifier = type === "text" ? textIdentifier : itemIdentifier;

        try {
            const contextString = await readText(`${identifier}-context:context`, workspaceBlock, true);

            if (!contextString) throw new Error("No context");

            textContext = JSON.parse(contextString);
        } catch (error) {
            textContext = {}
        }

        return textContext;
    }

    const addContext = async (type: ContextType, id: string, length: number, workspaceBlock: Block) => {
        const context = await readContext(type, workspaceBlock);
        context[id] = length;
        
        return writeContext(type, context, workspaceBlock);
    }
    
    const removeContext = async (type: ContextType, id: string, workspaceBlock: Block) => {
        const context = await readContext(type, workspaceBlock);
        delete context[id];
        
        return writeContext(type, context, workspaceBlock);
    }

    const getFreeWorkspaceIndex = () => {
        const freeWorkspaceIndex = isProcessing.findIndex(condition => !condition);

        if (freeWorkspaceIndex === -1) {
            let minLength = Infinity;
            let minIndex = -1;

            for (let index = 0; index < requestQueues.length; index++) {
                const requestQueue = requestQueues[index];

                const queueLength = requestQueue.length;

                if (queueLength >= minLength) continue;

                minLength = queueLength;
                minIndex = index;
            }

            return minIndex;
        }
        else {

            return freeWorkspaceIndex;

        }
    }

    const sendRequest = (request: StorageRequest) => {
        if (!isStarted) return;

        const freeWorkspaceIndex = getFreeWorkspaceIndex();

        requestQueues[freeWorkspaceIndex].push(request);

        if (!isProcessing[freeWorkspaceIndex]) processRequest(freeWorkspaceIndex);
    }

    const processRequest = async (workspaceIndex: number) => {
        if (isProcessing[workspaceIndex]) return;

        isProcessing[workspaceIndex] = true;
        const workspaceBlock = workspaceBlocks[workspaceIndex];
        
        while (requestQueues[workspaceIndex].length !== 0) {
            const request = requestQueues[workspaceIndex][0]!;

            if (request.method === "write") {
                if (request.dataType === "text") {
                    const result = await writeText(`${textIdentifier}:${request.id}`, request.text, workspaceBlock);
                    request.onEnd(result);
                }
                else if (request.dataType === "item") {
                    const result = await writeItems(`${itemIdentifier}:${request.id}`, request.itemStates, workspaceBlock)
                    request.onEnd(result);
                }
                else if (request.dataType === "textContext") {
                    const result = await writeContext("text", request.context, workspaceBlock);
                    request.onEnd(result);
                }
                else if (request.dataType === "itemContext") {
                    const result = await writeContext("item", request.context, workspaceBlock);
                    request.onEnd(result);
                }
            }
            else if (request.method === "read") {
                if (request.dataType === "text") {
                    const result = await readText(`${textIdentifier}:${request.id}`, workspaceBlock);
                    request.onEnd(result);
                }
                else if (request.dataType === "item") {
                    const result = await readItems(`${itemIdentifier}:${request.id}`, workspaceBlock);
                    request.onEnd(result);
                }
                else if (request.dataType === "textContext") {
                    const result = await readContext("text", workspaceBlock);
                    request.onEnd(result);
                }
                else if (request.dataType === "itemContext") {
                    const result = await readContext("item", workspaceBlock);
                    request.onEnd(result);
                }
            }
            else if (request.method === "delete") {
                const result = await deleteId(request.dataType, `${textIdentifier}:${request.id}`, workspaceBlock);
                request.onEnd(result);
            }

            requestQueues[workspaceIndex].shift();
        }

        isProcessing[workspaceIndex] = false;
    }
}