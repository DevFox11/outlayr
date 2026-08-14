import { fireEvent, render } from "@testing-library/react-native";

import { ResumeNotice } from "./resume-notice";

jest.mock("@/i18n/context", () => ({
    useTranslation: () => (key: string) => key,
}));

describe("resumeNotice", () => {
    it("renders the resume copy and calls onStartOver when Start over is pressed", async () => {
        const onStartOver = jest.fn();
        const { getByText, getByTestId } = await render(<ResumeNotice onStartOver={onStartOver} />);

        expect(getByText("import.resumeNotice")).toBeTruthy();

        fireEvent.press(getByTestId("import-resume-start-over"));

        expect(onStartOver).toHaveBeenCalledTimes(1);
    });
});
