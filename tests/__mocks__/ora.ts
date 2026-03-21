// Mock ora for ESM compatibility
const ora = (text: string) => ({
  start: () => ({
    text: text,
    succeed: (msg?: string) => msg || text,
    fail: (msg?: string) => msg || text,
    stop: () => {},
  }),
  succeed: (msg?: string) => msg,
  fail: (msg?: string) => msg,
  stop: () => {},
});

export default ora;
