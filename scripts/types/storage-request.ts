import { Context } from "./context";
import { ItemState } from "./item-state"

type StorageWriteRequest = {
    method: "write",
    id: string,
    dataType: "text",
    text: string,
    onEnd(writeComplete: boolean): void;
} | {
    method: "write",
    id: string,
    dataType: "item",
    itemStates: ItemState[]
    onEnd(writeComplete: boolean): void;
} | {
    method: "write",
    dataType: "textContext",
    context: Context,
    onEnd(writeComplete: boolean): void;
} | {
    method: "write",
    dataType: "itemContext",
    context: Context
    onEnd(writeComplete: boolean): void;
}

type StorageReadRequest = {
    method: "read",
    id: string,
    dataType: "text",
    onEnd(text: string | undefined): void;
} | {
    method: "read",
    id: string,
    dataType: "item",
    onEnd(itemStates: ItemState[] | undefined): void;
} | {
    method: "read",
    dataType: "textContext",
    onEnd(context: Context): void;
} | {
    method: "read",
    dataType: "itemContext",
    onEnd(context: Context): void;
}

type StorageDeleteRequest = {
    method: "delete",
    id: string,
    dataType: "text",
    onEnd(deleteComplete: boolean): void;
} | {
    method: "delete",
    id: string,
    dataType: "item",
    onEnd(deleteComplete: boolean): void;
}

export type StorageRequest = StorageReadRequest | StorageWriteRequest | StorageDeleteRequest;