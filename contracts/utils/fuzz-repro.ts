import assert from "assert";
import { $, argv, fs } from "zx";
import { logError, ReproducibleCounterexampleJson, reproFile, reproFunction } from "./fuzz-common";

const main = async () => {
  if (argv.help || argv._.length == 0) {
    console.log("Usage: pnpm fuzz-repro <counterexample> -- [forge test args]");
    return;
  }

  const [inputFile, ...forgeArgs] = argv._ as string[];
  const counterexample = await fs.readJSON(inputFile) as ReproducibleCounterexampleJson;

  const reproStream = fs.createWriteStream(reproFile);
  reproStream.write("pragma solidity ^0.8.18;\n");
  reproStream.write("\n");
  reproStream.write(`import {${counterexample.contract}} from "${counterexample.solPath}";\n`);
  reproStream.write("\n");
  reproStream.write(`contract ${counterexample.contract}Repro is ${counterexample.contract} {\n`);
  reproStream.write(`    function ${reproFunction}() external {\n`);

  for (const call of counterexample.sequence) {
    assert(call.sender in counterexample.labels);
    assert(call.addr in counterexample.labels);

    const caller = counterexample.labels[call.sender];
    const callee = counterexample.labels[call.addr];

    const functionNameGroups = call.signature.match(/^(.+)\(.*\)$/);
    assert(functionNameGroups);

    const functionName = functionNameGroups[1];
    const args = call.args.replace(/ \[[^\]]+\]/g, "");

    reproStream.write(`        vm.prank(${caller});\n`);
    reproStream.write(`        ${callee}.${functionName}(${args});\n`);
    reproStream.write("\n");
  }

  reproStream.write(`        this.${counterexample.test}();\n`);
  reproStream.write("    }\n");
  reproStream.write("}\n");
  reproStream.close();

  await $({
    stdio: "inherit",
    env: { ...process.env, ...counterexample.env },
  })`forge test --match-path ${reproFile} --match-test ${reproFunction} ${forgeArgs}`;
};

main().catch(logError);
