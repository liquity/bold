import { z } from "zod";
import { path, ProcessOutput } from "zx";

export const counterexamplesDir = "counterexamples";
export const counterexamplesFixedDir = "counterexamples-fixed";
export const counterexamplesAssumeDir = "counterexamples-assume";
export const reproDir = path.join("src", "test", "fuzz-repro");
export const reproFilesGlob = path.join(reproDir, "*");

export const TestListJson = z.record(z.record(z.array(z.string())));

export const CounterexampleSequenceJson = z.array(z.object({
  sender: z.string(),
  addr: z.string(),
  calldata: z.string(),
  contract_name: z.string(),
  signature: z.string(),
  args: z.string(),
}));

export type CounterexampleSequenceJson = z.infer<typeof CounterexampleSequenceJson>;

export const TestResultsJson = z.record(z.object({
  test_results: z.record(
    z.discriminatedUnion("status", [
      z.object({
        status: z.literal("Success"),
      }),

      z.object({
        status: z.literal("Failure"),
        reason: z.string(),

        counterexample: z.nullable(z.object({
          Sequence: CounterexampleSequenceJson,
        })),
      }),
    ]).and(
      z.object({
        labeled_addresses: z.record(z.string()),
      }),
    ),
  ),
}));

export interface ReproducibleCounterexampleJson {
  reason: string;
  solPath: string;
  contract: string;
  test: string;
  env: Record<string, string>;
  labels: Record<string, string>;
  sequence: CounterexampleSequenceJson;
}

export const logError = (err: unknown) => {
  if (err instanceof ProcessOutput) {
    process.exit(err.exitCode);
  } else {
    console.error(err);
    process.exit(1);
  }
};
