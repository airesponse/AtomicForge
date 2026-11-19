import { access, cp } from 'node:fs/promises';

const modelDirectory = new URL('./node_modules/@spotify/basic-pitch/model/', import.meta.url);
await access(new URL('model.json', modelDirectory));
await cp(modelDirectory, new URL('./generated/model/', import.meta.url), { recursive: true });
