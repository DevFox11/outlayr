import { font, foregroundStyle, frame } from "@expo/ui/swift-ui/modifiers";

export const ROW = [frame({ minHeight: 54 })];
export const BODY = font({ design: "rounded", textStyle: "body" });
export const CAPTION = font({ design: "rounded", textStyle: "caption" });

export const rowLabel = foregroundStyle({
    style: "secondary",
    type: "hierarchical",
});
