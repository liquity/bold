const { $ } = require("dax-sh");
const path = require("path");
const z = require("zod");
const fs = require("fs");

const rootDir = path.resolve(`${__dirname}/../..`);
const frontendDir = `${rootDir}/frontend`;
const contractsDir = `${rootDir}/contracts`;
const artifactsDir = `${frontendDir}/liquity-artifacts`;
const abisDir = `${rootDir}/frontend/src/abi`;

const ABIS = [
  "ActivePool",
  "BoldToken",
  "BorrowerOperations",
  "CollSurplusPool",
  "DefaultPool",
  "GasPool",
  "HintHelpers",
  "MultiTroveGetter",
  "PriceFeed",
  "SortedTroves",
  "StabilityPool",
  "TroveManager",
];

const ArtifactSchema = z.object({
  abi: z.array(z.unknown()),
});

function writeAbiFromArtifact(artifactPath: string, abiName: string) {
  const json = fs.readFileSync(artifactPath, "utf-8");
  const artifact = ArtifactSchema.parse(JSON.parse(json));
  const tsContent = `export const ${abiName} = ${JSON.stringify(artifact.abi, null, 2)} as const;`;
  fs.writeFileSync(`${abisDir}/${abiName}.ts`, tsContent);
}

async function main() {
  await $`forge build --root ${contractsDir} --out ${artifactsDir}`;
  for (const abiName of ABIS) {
    writeAbiFromArtifact(`${artifactsDir}/${abiName}.sol/${abiName}.json`, abiName);
  }
  await $`rm -rf ${artifactsDir}`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
