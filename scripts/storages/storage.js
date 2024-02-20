import { ItemStack, system, world } from "@minecraft/server";
import { isLocationEquals } from "../utils/equals";
import { getContainerFromBlock } from "../utils/get-container";
export var Storage;
(function (Storage) {
    const textIdentifier = "typi-storage";
    const itemIdentifier = "typi-item-storage";
    const overworld = world.getDimension("overworld");
    const workspaces = [];
    const requestQueues = [];
    const isProcessing = [];
    const workspaceBlocks = [];
    const NAME_MAX_STORAGE_SIZE = 255;
    const LORE_MAX_STORAGE_SIZE = 1000; // 20 * 50
    const SLOT_MAX_STORAGE_SIZE = 1255; // 255 + 20 * 50
    const CONTAINER_MAX_STORAGE_SIZE = 33885; // (255 + 20 * 50) * 27
    let isStarted = false;
    Storage.addWorkspace = (workspace) => {
        if (isStarted)
            return;
        const exists = workspaces.some(element => isLocationEquals(element, workspace));
        if (exists)
            throw new Error("Workspace already exists");
        workspaces.push(workspace);
        requestQueues.push([]);
        isProcessing.push(false);
    };
    Storage.start = async () => {
        const workspaceMinX = Math.min(...workspaces.map(workspace => workspace.x));
        const workspaceMaxX = Math.max(...workspaces.map(workspace => workspace.x));
        const workspaceMinZ = Math.min(...workspaces.map(workspace => workspace.z));
        const workspaceMaxZ = Math.max(...workspaces.map(workspace => workspace.z));
        await overworld.runCommandAsync(`tickingarea remove "${textIdentifier}"`);
        const commandResult = await overworld.runCommandAsync(`tickingarea add ${workspaceMinX} 0 ${workspaceMinZ} ${workspaceMaxX} 0 ${workspaceMaxZ} "${textIdentifier}"`);
        for (const workspace of workspaces) {
            const block = overworld.getBlock(workspace);
            if (!block)
                return false;
            workspaceBlocks.push(block);
        }
        if (commandResult.successCount !== 0)
            isStarted = true;
        return true;
    };
    Storage.sendWriteTextRequest = (id, text) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "write",
                id,
                dataType: "text",
                text,
                onEnd
            });
        });
    };
    Storage.sendReadTextRequest = (id) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "read",
                id,
                dataType: "text",
                onEnd
            });
        });
    };
    Storage.sendDeleteTextRequest = (id) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "delete",
                id,
                dataType: "text",
                onEnd
            });
        });
    };
    Storage.sendWriteItemsRequest = (id, itemStates) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "write",
                id,
                dataType: "item",
                itemStates,
                onEnd
            });
        });
    };
    Storage.sendReadItemsRequest = (id) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "read",
                id,
                dataType: "item",
                onEnd
            });
        });
    };
    Storage.sendDeleteItemRequest = (id) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "delete",
                id,
                dataType: "item",
                onEnd
            });
        });
    };
    const sendWriteTextContextRequest = (context) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "write",
                dataType: "textContext",
                context,
                onEnd
            });
        });
    };
    Storage.sendReadTextContextRequest = () => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "read",
                dataType: "textContext",
                onEnd
            });
        });
    };
    const sendWriteItemContextRequest = (context) => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "write",
                dataType: "itemContext",
                context,
                onEnd
            });
        });
    };
    Storage.sendReadItemContextRequest = () => {
        return new Promise((onEnd, onError) => {
            sendRequest({
                method: "read",
                dataType: "itemContext",
                onEnd
            });
        });
    };
    const writeText = (id, text, workspaceBlock, contextMode = false) => {
        return new Promise((resolve, reject) => {
            system.run(async () => {
                if (!isStarted)
                    return resolve(false);
                workspaceBlock.setType("minecraft:chest");
                const container = getContainerFromBlock(workspaceBlock);
                if (!container)
                    return resolve(false);
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
                            const lore = [];
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
                        if (commandResult.successCount === 0)
                            break;
                    }
                }
                if (!contextMode)
                    await addContext("text", id, length, workspaceBlock);
                else
                    container.clearAll();
                resolve(true);
            });
        });
    };
    const readText = (id, workspaceBlock, contextMode = false) => {
        return new Promise((resolve, reject) => {
            system.run(async () => {
                if (!isStarted)
                    return resolve(undefined);
                let readComplete = false;
                let containerIndex = 0;
                let result = "";
                let container;
                while (true) {
                    const commandResult = await overworld.runCommandAsync(`structure load "${id}-${containerIndex}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z}`);
                    if (commandResult.successCount === 0)
                        break;
                    container = getContainerFromBlock(workspaceBlock);
                    if (!container)
                        return resolve(undefined);
                    readComplete = true;
                    for (let slotIndex = 0; slotIndex < container.size; slotIndex++) {
                        const itemStack = container.getItem(slotIndex);
                        if (!itemStack)
                            continue;
                        result += itemStack.nameTag;
                        result += itemStack.getLore().join("");
                    }
                    containerIndex++;
                }
                container?.clearAll();
                resolve(readComplete ? result : undefined);
            });
        });
    };
    const deleteId = async (type, id, workspaceBlock) => {
        if (!isStarted)
            return false;
        let deleteComplete = false;
        let containerIndex = 0;
        while (true) {
            const commandResult = await overworld.runCommandAsync(`structure delete "${id}-${containerIndex}"`);
            if (commandResult.successCount === 0)
                break;
            deleteComplete = true;
            containerIndex++;
        }
        return deleteComplete && removeContext(type, id, workspaceBlock);
    };
    const writeItems = (id, itemStates, workspaceBlock) => {
        return new Promise((resolve, reject) => {
            system.run(async () => {
                if (!isStarted)
                    return resolve(false);
                const chestContainer = getContainerFromBlock(workspaceBlock);
                world.sendMessage(`processor id: ${workspaceBlocks.indexOf(workspaceBlock)}`);
                if (!chestContainer)
                    return resolve(false);
                let index = -1;
                let containerLength = 0;
                while (true) {
                    index++;
                    world.sendMessage(`index: ${index}; still running`);
                    if (index < itemStates.length / chestContainer.size) {
                        chestContainer.clearAll();
                        for (let slotId = 0; slotId < chestContainer.size; slotId++) {
                            let sourceIndex = index * chestContainer.size + slotId;
                            if (sourceIndex >= itemStates.length)
                                break;
                            const sourceItem = itemStates[sourceIndex];
                            if (!sourceItem)
                                continue;
                            chestContainer.setItem(slotId, sourceItem);
                        }
                        await overworld.runCommandAsync(`structure save "${id}-${index}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z} ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z} false disk true`);
                        containerLength = index + 1;
                    }
                    else {
                        const commandResult = await overworld.runCommandAsync(`structure delete "${id}-${index}"`);
                        if (commandResult.successCount === 0)
                            break;
                    }
                }
                await addContext("item", id, containerLength, workspaceBlock);
                return resolve(true);
            });
        });
    };
    const readItems = (id, workspaceBlock) => {
        return new Promise((resolve, reject) => {
            system.run(async () => {
                if (!isStarted)
                    return resolve(undefined);
                let readComplete = false;
                let index = 0;
                const items = [];
                while (true) {
                    const commandResult = await overworld.runCommandAsync(`structure load "${id}-${index}" ${workspaceBlock.x} ${workspaceBlock.y} ${workspaceBlock.z}`);
                    if (commandResult.successCount === 0)
                        break;
                    readComplete = true;
                    const container = getContainerFromBlock(workspaceBlock);
                    if (!container)
                        return resolve(undefined);
                    for (let slotId = 0; slotId < container.size; slotId++) {
                        const itemStack = container.getItem(slotId);
                        items.push(itemStack ? itemStack : null);
                    }
                    index++;
                }
                return resolve(readComplete ? items : undefined);
            });
        });
    };
    const writeContext = async (type, context, workspaceBlock) => {
        const contextString = JSON.stringify(context);
        const identifier = type === "text" ? textIdentifier : itemIdentifier;
        return await writeText(`${identifier}-context:context`, contextString, workspaceBlock, true);
    };
    const readContext = async (type, workspaceBlock) => {
        let textContext;
        const identifier = type === "text" ? textIdentifier : itemIdentifier;
        try {
            const contextString = await readText(`${identifier}-context:context`, workspaceBlock, true);
            if (!contextString)
                throw new Error("No context");
            textContext = JSON.parse(contextString);
        }
        catch (error) {
            textContext = {};
        }
        return textContext;
    };
    const addContext = async (type, id, length, workspaceBlock) => {
        const context = await readContext(type, workspaceBlock);
        context[id] = length;
        return writeContext(type, context, workspaceBlock);
    };
    const removeContext = async (type, id, workspaceBlock) => {
        const context = await readContext(type, workspaceBlock);
        delete context[id];
        return writeContext(type, context, workspaceBlock);
    };
    const getFreeWorkspaceIndex = () => {
        const freeWorkspaceIndex = isProcessing.findIndex(condition => !condition);
        if (freeWorkspaceIndex === -1) {
            let minLength = Infinity;
            let minIndex = -1;
            for (let index = 0; index < requestQueues.length; index++) {
                const requestQueue = requestQueues[index];
                const queueLength = requestQueue.length;
                if (queueLength >= minLength)
                    continue;
                minLength = queueLength;
                minIndex = index;
            }
            return minIndex;
        }
        else {
            return freeWorkspaceIndex;
        }
    };
    const sendRequest = (request) => {
        if (!isStarted)
            return;
        const freeWorkspaceIndex = getFreeWorkspaceIndex();
        requestQueues[freeWorkspaceIndex].push(request);
        if (!isProcessing[freeWorkspaceIndex])
            processRequest(freeWorkspaceIndex);
    };
    const processRequest = async (workspaceIndex) => {
        if (isProcessing[workspaceIndex])
            return;
        isProcessing[workspaceIndex] = true;
        const workspaceBlock = workspaceBlocks[workspaceIndex];
        while (requestQueues[workspaceIndex].length !== 0) {
            const request = requestQueues[workspaceIndex][0];
            if (request.method === "write") {
                if (request.dataType === "text") {
                    const result = await writeText(`${textIdentifier}:${request.id}`, request.text, workspaceBlock);
                    request.onEnd(result);
                }
                else if (request.dataType === "item") {
                    const result = await writeItems(`${itemIdentifier}:${request.id}`, request.itemStates, workspaceBlock);
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
    };
})(Storage || (Storage = {}));
