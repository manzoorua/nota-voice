import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// jsdom doesn't implement these — Radix dialog & friends touch them.
if (!(HTMLCanvasElement.prototype as any).getContext) {
  (HTMLCanvasElement.prototype as any).getContext = () => null;
}
if (!(Element.prototype as any).scrollIntoView) {
  (Element.prototype as any).scrollIntoView = () => {};
}
if (!(window as any).ResizeObserver) {
  (window as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
