import { fs, glob, path } from "zx";

const bytecodeType = "`0x${string}`";

const main = async () => {
  const artifactFiles = await glob("out/*.sol/*.json");

  const abiDeclarations = [...new Map(
    await Promise.all(artifactFiles.map(async (artifactFile) => {
      const contractName = path.basename(artifactFile, ".json");
      const artifact = await fs.readJSON(artifactFile);

      return [
        contractName,
        [
          `export const abi${contractName} = ${JSON.stringify(artifact.abi, null, 2)} as const;`,
          `export const bytecode${contractName}: ${bytecodeType} = "${artifact.bytecode.object}";`,
        ].join("\n\n"),
      ] satisfies [string, string];
    })),
  ).values()];

  await fs.mkdirp("abi");
  await fs.writeFile(
    "abi/index.ts",
    `${abiDeclarations.join("\n\n")}\n`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
