import { cloudRuntime } from "./cloud-runtime";

export const authClient = cloudRuntime?.authClient ?? null;
