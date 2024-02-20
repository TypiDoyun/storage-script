export const getContainerFromBlock = (block) => {
    const inventory = block.getComponent("inventory");
    const container = inventory?.container;
    if (!inventory)
        return;
    if (!container)
        return;
    return container;
};
export const getContainerFromEntity = (entity) => {
    const inventory = entity.getComponent("inventory");
    const container = inventory?.container;
    if (!inventory)
        return;
    if (!container)
        return;
    return container;
};
