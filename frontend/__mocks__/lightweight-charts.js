// Mock for lightweight-charts — avoids canvas dependency in jsdom
const createChart = jest.fn(() => ({
  addCandlestickSeries: jest.fn(() => ({
    setData: jest.fn(),
    setMarkers: jest.fn(),
    applyOptions: jest.fn(),
  })),
  addAreaSeries: jest.fn(() => ({
    setData: jest.fn(),
    applyOptions: jest.fn(),
  })),
  applyOptions: jest.fn(),
  resize: jest.fn(),
  remove: jest.fn(),
  timeScale: jest.fn(() => ({ fitContent: jest.fn() })),
}));

module.exports = { createChart };
