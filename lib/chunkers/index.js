export default async (chunker = 'Treesitter') => {
  let module;

  try {
    module = await import(`./${chunker}.js`);
  } catch(e) {
    console.log('e: ', e);
    throw new Error(`Cant load ${chunker}`);
  }

  return module.default;
}
