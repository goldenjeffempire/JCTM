import "@testing-library/jest-dom";

// Silence framer-motion warnings about missing ResizeObserver in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
