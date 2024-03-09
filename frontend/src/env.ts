import z from "zod";

export const EnvSchema = z.object({
  WALLET_CONNECT_PROJECT_ID: z.string(),
});

export type Env = z.infer<typeof EnvSchema>;

export const {
  WALLET_CONNECT_PROJECT_ID,
} = EnvSchema.parse({
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
});
