import { Block, Entity } from "@minecraft/server";

export const getContainerFromBlock = (block: Block) => {
    const inventory = block.getComponent("inventory");
    const container = inventory?.container;
    
    if (!inventory) return;
    if (!container) return;
    
    return container;
}

export const getContainerFromEntity = (entity: Entity) => {
    const inventory = entity.getComponent("inventory");
    const container = inventory?.container;
    
    if (!inventory) return;
    if (!container) return;
    
    return container;
}