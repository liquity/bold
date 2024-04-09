const { $ } = require("dax-sh");
const path = require("path");
const z = require("zod");
const fs = require("fs").promises;

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

async function writeAbiFromArtifact(artifactPath: string, abiName: string) {
  const json = await fs.readFile(artifactPath, "utf-8");
  const artifact = ArtifactSchema.parse(JSON.parse(json));

  const tsFileContent = [
    "// this file was generated by scripts/update-liquity-abis.ts",
    "// please do not edit it manually",
    `export const ${abiName} = ${JSON.stringify(artifact.abi)} as const;`,
  ].join("\n");

  await fs.writeFile(`${abisDir}/${abiName}.ts`, tsFileContent);
  await $`dprint --log-level silent fmt ${abisDir}/${abiName}.ts`;
}

async function main() {
  console.log("👉 Building Liquity contracts…\n");
  await $`forge build --root ${contractsDir} --out ${artifactsDir}`;

  console.log("👉 Building promises…");
  await Promise.all(ABIS.map(async (abiName) => (
    writeAbiFromArtifact(
      `${artifactsDir}/${abiName}.sol/${abiName}.json`,
      abiName,
    )
  )));

  console.log("👉 Removing temporary artifacts…");
  await $`rm -rf ${artifactsDir}`;
  console.log("\nDone.");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
