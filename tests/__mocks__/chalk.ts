// Mock chalk for ESM compatibility - supports chained calls
const chainable = (text: string) => text;

const createChainable = () => {
  const fn = (text: string) => text;
  fn.red = chainable;
  fn.green = chainable;
  fn.blue = chainable;
  fn.yellow = chainable;
  fn.cyan = createChainable;
  fn.white = chainable;
  fn.grey = chainable;
  fn.dim = chainable;
  fn.bold = chainable;
  return fn;
};

const chalk = {
  red: createChainable(),
  green: createChainable(),
  blue: createChainable(),
  yellow: createChainable(),
  cyan: createChainable(),
  white: createChainable(),
  grey: createChainable(),
  dim: createChainable(),
  bold: createChainable(),
};

export default chalk;
export const { red, green, blue, yellow, cyan, white, grey, dim, bold } = chalk;
