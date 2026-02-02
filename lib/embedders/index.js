export default async (embedder = 'Transformers') => {
  const module = await import(`./${embedder}.js`);

  return module.default;
}
