export type QueryStatus = "success" | "error" | "pending";

// function combineStatus(a: "error", b: QueryStatus): "error";
// function combineStatus(a: QueryStatus, b: "error"): "error";
// function combineStatus(a: "pending", b: Exclude<QueryStatus, "error">): "pending";
// function combineStatus(a: Exclude<QueryStatus, "error">, b: "pending"): "pending";
// function combineStatus(a: "success", b: "success"): "success";
// function combineStatus(
//   a: Exclude<QueryStatus, "pending">,
//   b: Exclude<QueryStatus, "pending">,
// ): Exclude<QueryStatus, "pending">;
// function combineStatus(a: QueryStatus, b: QueryStatus): QueryStatus;
export function combineStatus(a: QueryStatus, b: QueryStatus): QueryStatus {
  if (a === "error" || b === "error") return "error";
  if (a === "pending" || b === "pending") return "pending";
  return "success";
}
