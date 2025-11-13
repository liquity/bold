import { useQuery } from "@tanstack/react-query";

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

const COINGECKO_IDS: Record<string, string> = {
  WETH: "ethereum",
  TBTC: "tbtc",
  SAGA: "saga",
  STATOM: "stride-staked-atom",
  YUSD: "yusd-stablecoin",
  MUST: "must-stablecoin",
};

const COINGECKO_CONTRACT_ADDRESSES: Record<string, string> = {
  YETH: "0x8464f6ecae1ea58ec816c13f964030eab8ec123a",
  KING: "0x8f08b70456eb22f6109f57b8fafe862ed28e6040",
};

export function useCoinGeckoPrices(symbols: string[]) {
  return useQuery({
    queryKey: ["coingecko-prices", symbols],
    queryFn: async () => {
      const prices: Record<string, number> = {};

      const symbolsWithIds = symbols.filter(s => COINGECKO_IDS[s]);
      const symbolsWithContracts = symbols.filter(s => COINGECKO_CONTRACT_ADDRESSES[s]);

      if (symbolsWithIds.length > 0) {
        const ids = symbolsWithIds.map(symbol => COINGECKO_IDS[symbol]).join(",");
        
        const url = `/api/coingecko/price?ids=${ids}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          symbolsWithIds.forEach(symbol => {
            const id = COINGECKO_IDS[symbol];
            if (id && data[id]?.usd) {
              prices[symbol] = data[id].usd;
            }
          });
        }
      }

      if (symbolsWithContracts.length > 0) {
        const contractAddresses = symbolsWithContracts
          .map(s => COINGECKO_CONTRACT_ADDRESSES[s])
          .join(",");
        
        const url = `/api/coingecko/token-price?contract_addresses=${contractAddresses}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          symbolsWithContracts.forEach(symbol => {
            const contractAddress = COINGECKO_CONTRACT_ADDRESSES[symbol]?.toLowerCase();
            if (contractAddress && data[contractAddress]?.usd) {
              prices[symbol] = data[contractAddress].usd;
            }
          });
        }
      }

      return prices;
    },
    staleTime: 60000,
    refetchInterval: 60000,
    enabled: symbols.length > 0,
  });
}
