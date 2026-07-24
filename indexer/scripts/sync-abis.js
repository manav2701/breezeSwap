const fs = require('fs');
const path = require('path');

const contracts = [
  { name: 'BreezeMarketFactory', file: 'BreezeMarketFactory.sol/BreezeMarketFactory.json' },
  { name: 'BreezeMarket', file: 'BreezeMarket.sol/BreezeMarket.json' },
  { name: 'PositionToken', file: 'PositionToken.sol/PositionToken.json' },
  { name: 'MockWeatherOracle', file: 'MockWeatherOracle.sol/MockWeatherOracle.json' }
];

const outDir = path.join(__dirname, '../../contracts/out');
const abisDir = path.join(__dirname, '../src/abis');

if (!fs.existsSync(abisDir)) {
  fs.mkdirSync(abisDir, { recursive: true });
}

for (const contract of contracts) {
  const artifactPath = path.join(outDir, contract.file);
  if (!fs.existsSync(artifactPath)) {
    console.error(`Artifact not found for ${contract.name} at ${artifactPath}`);
    continue;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const abiPath = path.join(abisDir, `${contract.name}.json`);
  fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
  console.log(`Synced ABI for ${contract.name} -> ${abiPath}`);
}
