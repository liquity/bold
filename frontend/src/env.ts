import z from "zod";

export const EnvSchema = z
  .object({
    VITE_WALLET_CONNECT_PROJECT_ID: z.string(),
  })
  .transform((env) => ({
    WALLET_CONNECT_PROJECT_ID: env.VITE_WALLET_CONNECT_PROJECT_ID,
  }));

export type Env = z.infer<typeof EnvSchema>;

export const {
  WALLET_CONNECT_PROJECT_ID,
} = EnvSchema.parse(import.meta.env);
