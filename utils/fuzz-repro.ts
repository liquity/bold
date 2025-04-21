import assert from "assert";
import { $, argv, chalk, fs, glob, path } from "zx";
import {
  counterexamplesAssumeDir,
  counterexamplesDir,
  counterexamplesFixedDir,
  logError,
  reproDir,
  ReproducibleCounterexampleJson,
  reproFilesGlob,
  TestResultsJson,
} from "./fuzz-common";

const reproKeyPrefix = "test_Counterexample";
const counterexamplesGlob = path.join(counterexamplesDir, "**", "*.json");
const counterexamplesDirPrefix = new RegExp("^" + counterexamplesDir);
const counterexamplesPerRun = 10;
const spaces = 4;

// These don't have an effect on reproduction
const ignoredEnv = new Set([
  "FOUNDRY_INVARIANT_RUNS",
  "FOUNDRY_INVARIANT_DEPTH",
]);

const filterEnv = (env: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.entries(env).filter(([k]) => !ignoredEnv.has(k)));

const envKey = (env: Record<string, string>) => Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n");

const range = (n: number) => [...new Array(n).keys()];

const chop = (n: number) => <T>(ts: T[]) => range(Math.ceil(ts.length / n)).map((i) => ts.slice(n * i, n * (i + 1)));

const indent = (n: number) => (line: string) => line.length > 0 ? " ".repeat(n) + line : line;

const mv = async (oldPath: string, newDir: string) => {
  const newPath = oldPath.replace(counterexamplesDirPrefix, newDir);
  await $`mkdir -p ${path.dirname(newPath)}`;
  await $`mv ${oldPath} ${newPath}`;
  return newPath;
};

const reproFile = (
  inputFile: string,
  functionName: string,
  counterexample: ReproducibleCounterexampleJson,
) =>
  [
    `pragma solidity ^0.8.18;`,
    ``,
    `import {${counterexample.contract}} from "${counterexample.solPath}";`,
    ``,
    `contract ${counterexample.contract}Repro is ${counterexample.contract} {`,
    ...[
      `// ${inputFile}`,
      `function ${functionName}() external {`,
      ...[
        ...counterexample.sequence.flatMap((call) => {
          assert(call.sender in counterexample.labels);
          assert(call.addr in counterexample.labels);

          const caller = counterexample.labels[call.sender];
          const callee = counterexample.labels[call.addr];

          const functionNameGroups = call.signature.match(/^(.+)\(.*\)$/);
          assert(functionNameGroups);

          const [, functionName] = functionNameGroups;
          const args = call.args.replace(/ \[[^\]]+\]/g, "");

          return [
            `vm.prank(${caller});`,
            `${callee}.${functionName}(${args});`,
            ``,
          ];
        }),
        `this.${counterexample.test}();`,
      ].map(indent(spaces)),
      `}`,
    ].map(indent(spaces)),
    `}`,
    ``,
  ].join("\n");

const main = async () => {
  if (argv.help || argv._.length == 0) {
    console.log("Usage: pnpm fuzz-repro all|<counterexample> -- [forge test args]");
    return;
  }

  const [arg1, ...customTestArgs] = argv._ as string[];
  const inputFiles = arg1 === "all" ? await glob(counterexamplesGlob) : [arg1];

  const counterexamples = (
    await Promise.all(
      inputFiles.map((inputFile) =>
        fs.readJSON(inputFile).then((counterexample: ReproducibleCounterexampleJson) => ({
          ...counterexample,
          inputFile,
        }))
      ),
    )
  )
    .map((counterexample) => ({ ...counterexample, env: filterEnv(counterexample.env) }))
    .map((counterexample) => ({ ...counterexample, envKey: envKey(counterexample.env) }));

  const envKeys = new Set(counterexamples.map((counterexample) => counterexample.envKey));

  const counterexampleMap = new Map(
    counterexamples.map((counterexample, i) => [
      `${reproKeyPrefix}${i}_${counterexample.contract}_${counterexample.test}`,
      counterexample,
    ]),
  );

  for (const envKey of envKeys) {
    const envCounterexamples = [...counterexampleMap.entries()].filter(([, c]) => c.envKey === envKey);
    const [[, { env }]] = envCounterexamples;

    console.log("Environment:", env);
    console.log();

    for (const slice of chop(counterexamplesPerRun)(envCounterexamples)) {
      await $`rm -rf ${reproDir}`;
      await $`mkdir -p ${reproDir}`;

      for (const [reproKey, counterexample] of slice) {
        await fs.writeFile(
          path.join(reproDir, `${reproKey}.t.sol`),
          reproFile(counterexample.inputFile, reproKey, counterexample),
        );
      }

      const testFilterArgs = ["--match-path", reproFilesGlob, "--match-test", `^${reproKeyPrefix}`];

      if (arg1 == "all") {
        const results = Object.values(TestResultsJson.parse(
          await $({
            env: { ...process.env, ...env },
          })`forge test ${testFilterArgs} --allow-failure --json`.json(),
        ))
          .flatMap((x) => Object.entries(x.test_results))
          .map(([functionName, result]) => ({ reproKey: functionName.replace(/\(\)$/, ""), result }))
          .map((x) => ({ ...x, counterexample: counterexampleMap.get(x.reproKey)! }));

        for (const { result, counterexample } of results) {
          if (result.status === "Success") {
            const newPath = await mv(counterexample.inputFile, counterexamplesFixedDir);
            console.log(`${chalk.green("SUCC")} ${newPath}`);
          } else if (result.reason === "FOUNDRY::ASSUME") {
            const newPath = await mv(counterexample.inputFile, counterexamplesAssumeDir);
            console.log(`${chalk.yellow("ASSU")} ${newPath}`);
          } else {
            console.log(`${chalk.red("FAIL")} ${counterexample.inputFile}`);
            console.log(`       ${chalk.bold(result.reason)}`);
          }
        }
      } else {
        await $({
          stdio: "inherit",
          env: { ...process.env, ...env },
        })`forge test ${testFilterArgs} ${customTestArgs}`;
      }
    }

    console.log();
  }
};

main().catch(logError);
