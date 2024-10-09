import PQueue from "p-queue";
import { $, chalk, fs, path, sleep } from "zx";
import {
  counterexamplesDir,
  logError,
  ReproducibleCounterexampleJson,
  reproFilesGlob,
  TestListJson,
  TestResultsJson,
} from "./fuzz-common";

const debug = !!process.env.DEBUG;
const concurrency = 24;
const softStartDelayMs = 1000;
const testFilter = "^invariant";
const failuresDir = path.join("cache", "invariant", "failures");

const dimensions: Record<string, Record<string, string>>[] = [
  {
    "1coll": { NUM_BRANCHES: "1" },
    "3coll": { NUM_BRANCHES: "3" },
  },
  {
    "skin": { FOUNDRY_INVARIANT_RUNS: "500", FOUNDRY_INVARIANT_DEPTH: "100" },
    "deep": { FOUNDRY_INVARIANT_RUNS: "50", FOUNDRY_INVARIANT_DEPTH: "1000" },
  },
];

const cross = <T extends unknown[], U extends unknown[]>(ts: T[], us: U[]) =>
  ts.flatMap((t) => us.map((u): [...T, ...U] => [...t, ...u]));

const matrix = dimensions
  .map((dim) => Object.entries(dim).map((keyEnv) => [keyEnv]))
  .reduce(cross)
  .map((keyEnvs) =>
    keyEnvs.reduce(([keyA, envA], [keyB, envB]) => [
      `${keyA}-${keyB}`,
      { ...envA, ...envB },
    ])
  );

const log = {
  debug(...args: unknown[]) {
    if (debug) console.log(chalk.gray(...args));
  },

  info(...args: unknown[]) {
    console.log(...args);
  },

  error(...args: unknown[]) {
    console.log(chalk.red(...args));
  },
};

const shortReason = (reason: string) => {
  const groups = reason.match(/^([^:]+): [0-9]+(\.[0-9]+)? (<|<=|>|>=|==|!=|!~=) [0-9]+(\.[0-9]+)?/);
  return groups ? groups[1] : reason;
};

const main = async () => {
  await $({ stdio: "inherit" })`forge build`;

  const testListJson = TestListJson.parse(
    await $`forge test ${[
      "--no-match-path",
      reproFilesGlob,
      "--match-test",
      testFilter,
      "--list",
      "--json",
    ]}`.json(),
  );

  const tests = Object.entries(testListJson).flatMap(([solPath, contractsTests]) =>
    Object.entries(contractsTests).flatMap(([contract, tests]) =>
      tests.flatMap((test) => ({
        solPath,
        contract,
        test,
      }))
    )
  );

  log.info(
    `Testing ${tests.length} invariants `
      + `in ${matrix.length} configurations using ${concurrency} concurrent processes...`,
  );

  const sequential = new PQueue({ concurrency: 1 });
  const concurrent = new PQueue({ concurrency });

  tests.forEach(({ solPath, contract, test }) => {
    matrix.forEach(async ([key, env]) => {
      const logPrefix = `[${key}] ${contract}::${test}()`;

      for (;;) {
        await concurrent.add(async () => {
          // Workaround: avoid spawning a lot of child processes at the same time, as there can be race conditions
          await sequential.add(() => sleep(softStartDelayMs));

          // Workaround: don't replay previous failure (no way to disable this in Foundry)
          await $`rm -f ${failuresDir}/${contract}/${test}`;

          log.debug(`> ${logPrefix} started`);

          const results = TestResultsJson.parse(
            await $({ env: { ...process.env, ...env } })`forge test ${[
              "--match-path",
              solPath,
              "--match-contract",
              `^${contract}$`,
              "--match-test",
              `^${test}\\(\\)$`,
              "--allow-failure",
              "--json",
            ]}`.json(),
          );

          log.debug(`< ${logPrefix} finished`);

          const failures = Object.values(results)
            .flatMap((x) => Object.values(x.test_results))
            .filter((x) => x.status === "Failure");

          const dir = path.join(counterexamplesDir, contract, test);
          const file = path.join(dir, `${key}_${Date.now()}.json`);

          for (const failure of failures) {
            if (failure.counterexample != null) {
              const counterexample: ReproducibleCounterexampleJson = {
                reason: failure.reason,
                solPath,
                contract,
                test,
                env,
                labels: failure.labeled_addresses,
                sequence: failure.counterexample.Sequence,
              };

              await $`mkdir -p ${dir}`;
              await fs.writeJSON(file, counterexample, { spaces: 2 });

              log.info(
                `  ${logPrefix} counterexample (${chalk.bold(shortReason(failure.reason))}): ${chalk.underline(file)}`,
              );
            } else {
              log.error(`! ${logPrefix} failed: ${failure.reason}`);
            }
          }
        });
      }
    });
  });

  concurrent.on("error", logError);
};

main().catch(logError);
