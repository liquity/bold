import { z } from "zod";

export const PositionSchema = z.union([
  z.object({
    type: z.literal("borrowing"),
  }),
  z.object({
    type: z.literal("leveraged-position"),
    deposit: z.string(),
    leverage: z.number(),
  }),
]);

const summaries = {
  // openLeveragedPosition: {
  //   deposit,
  // },
};

export default summaries;
