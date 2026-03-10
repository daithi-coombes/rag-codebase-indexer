export default async (chunker = 'Treesitter') => {
  let module;

  try {
    module = await import(`./${chunker}.js`);
  /* eslint-disable-next-line no-unused-vars */
  } catch(err) {
    throw new Error(`Cant load ${chunker}`);
  }

  return module.default;
}
