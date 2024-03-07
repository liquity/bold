import z from "zod";

export const EnvSchema = z
  .object({
    WALLET_CONNECT_PROJECT_ID: z.string(),
  })
  .transform((env) => ({
    WALLET_CONNECT_PROJECT_ID: env.WALLET_CONNECT_PROJECT_ID,
  }));

export type Env = z.infer<typeof EnvSchema>;

export const {
  WALLET_CONNECT_PROJECT_ID,
} = EnvSchema.parse(process.env);
