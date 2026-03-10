const stores = [
  'Chroma',
  'Faiss'
];

export default async (store = 'Chroma') => {
  const _store = store.toLowerCase();
  const ModuleName = stores.find(s => s.toLowerCase() === _store);

  if (!ModuleName) {
    throw new Error(`Unknown store: ${store}`);
  }

  const module = await import(`./${ModuleName}.js`);

  return module.default;
}
