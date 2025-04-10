import util from "util";

export interface DuneResponse<Row = unknown> {
  result: { rows: Row[] };
}

export const isDuneResponse = (data: unknown): data is DuneResponse => {
  return typeof data === "object"
    && data !== null
    && "result" in data
    && typeof data.result === "object"
    && data.result !== null
    && "rows" in data.result
    && Array.isArray(data.result.rows);
};

export const duneFetch = async <T extends DuneResponse>({
  apiKey,
  url,
  validate
}: {
  apiKey: string;
  url: string;
  validate: (data: unknown) => data is T;
}): Promise<T> => {
  const response = await fetch(url, {
    headers: { "X-Dune-API-Key": apiKey }
  });
  const data = await response.json();

  console.log(
    `Dune response for ${url}:`,
    util.inspect(data, { colors: true, depth: null })
  );

  if (!validate(data)) {
    throw new Error("Dune query returned unexpected response");
  }

  return data;
};
