import { Location } from "../types/location";

export const isLocationEquals = (a: Location, b: Location): boolean => {
    return a.x === b.x && a.y === b.y && a.z === b.z;
}