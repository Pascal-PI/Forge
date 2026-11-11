'use strict';

const path = require('node:path');
const { build, Platform, Arch } = require('electron-builder');

async function main() {
  const identityName = process.env.FORGE_STORE_IDENTITY?.trim();
  const publisher = process.env.FORGE_STORE_PUBLISHER?.trim();
  const publisherDisplayName = process.env.FORGE_STORE_PUBLISHER_DISPLAY_NAME?.trim() || 'Voriq Studios';
  if (!identityName || !publisher) {
    throw Error('Set FORGE_STORE_IDENTITY and FORGE_STORE_PUBLISHER to the package identity values from Partner Center.');
  }
  const config = {
    appx: { identityName, publisher, publisherDisplayName, applicationId: 'Forge', displayName: 'FORGE', backgroundColor: '#0b1020' }
  };
  if (process.env.FORGE_STORE_OUTPUT) config.directories = { output: path.resolve(process.env.FORGE_STORE_OUTPUT) };
  await build({ targets: Platform.WINDOWS.createTarget(['appx'], Arch.x64), publish: 'never', config });
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
