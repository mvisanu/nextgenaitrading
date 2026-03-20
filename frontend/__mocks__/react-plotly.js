// Mock for react-plotly.js
const React = require("react");
const Plot = React.forwardRef((props, ref) =>
  React.createElement("div", { ref, "data-testid": "plotly-chart" })
);
Plot.displayName = "Plot";
module.exports = Plot;
module.exports.default = Plot;
