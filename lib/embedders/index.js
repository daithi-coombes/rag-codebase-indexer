const providers = [
  'Ollama',
  'Transformers'
];

export default async (provider = 'Transformers') => {
  const _provider = provider.toLowerCase();
  const ModuleName = providers.find(p => p.toLowerCase() === _provider);

  if (!ModuleName) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const module = await import(`./${ModuleName}.js`);

  return module.default;
}
