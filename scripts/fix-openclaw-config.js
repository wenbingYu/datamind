const fs = require('fs');

const path = '/Users/wenbing/.openclaw/openclaw.json';
const backup = `/Users/wenbing/.openclaw/openclaw.json.bak.${Date.now()}`;
const raw = fs.readFileSync(path, 'utf8');
const cfg = JSON.parse(raw);

fs.writeFileSync(backup, raw);

cfg.models ||= {};
cfg.models.providers ||= {};

const provider = (cfg.models.providers.custom_gpt ||= {});
provider.baseUrl ||= 'https://caddy.kernelsandmodels.space:8443/v1';
provider.apiKey = '${CUSTOM_GPT_API_KEY}';
provider.api = 'openai-completions';
provider.auth = 'api-key';
provider.authHeader = true;
delete provider.env_key;
delete provider.wire_api;
delete provider.requires_openai_auth;

if (Array.isArray(provider.models)) {
  for (const model of provider.models) {
    model.api ||= 'openai-completions';
  }
}

cfg.agents ||= {};
cfg.agents.defaults ||= {};
cfg.agents.defaults.model ||= {};
cfg.agents.defaults.model.primary = 'custom_gpt/gpt-5.4';

const existingModels = cfg.agents.defaults.models || {};
const nextModels = {};

for (const key of Object.keys(existingModels)) {
  if (!key.startsWith('bailian/')) {
    nextModels[key] = existingModels[key];
  }
}

nextModels['custom_gpt/gpt-5.4'] ||= {};

if (Array.isArray(provider.models)) {
  for (const model of provider.models) {
    nextModels[`custom_gpt/${model.id}`] ||= {};
  }
}

cfg.agents.defaults.models = nextModels;
cfg.meta ||= {};
cfg.meta.lastTouchedAt = new Date().toISOString();

fs.writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n');

console.log(JSON.stringify({
  backup,
  primary: cfg.agents.defaults.model.primary,
  models: Object.keys(cfg.agents.defaults.models),
}, null, 2));
