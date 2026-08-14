const react = require("react");

// `Stack.Toolbar` reads a RouterCompositionOptionsProvider that only a real
// navigator installs, so any component composing one is unmountable in a unit
// test without this. The Button is flattened to a host element whose press
// handler keeps the `onButtonPress` name the SwiftUI buttons use, so a test can
// find either kind of button the same way.
const Toolbar = ({ children }) => react.createElement(react.Fragment, null, children);

Toolbar.Button = ({ onPress, ...rest }) => react.createElement("ToolbarButton", { ...rest, onButtonPress: onPress });

module.exports = {
    Stack: { Toolbar },
    useNavigation: () => ({ setOptions: jest.fn() }),
    useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
};
