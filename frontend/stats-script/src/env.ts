import dotenv from 'dotenv';

dotenv.config();

if (!process.env.ALCHEMY_API_KEY) {
  throw new Error('Missing ALCHEMY_KEY in .env');
}

export const env = {
  ALCHEMY_KEY: process.env.ALCHEMY_API_KEY!,
  DUNE_KEY: process.env.DUNE_API_KEY!
};