import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import App from "./App";

test("the title is visible", () => {
  render(<App />);
  expect(screen.getByText(/Vite \+ React/i)).toBeInTheDocument();
});

test("should increment count on click", async () => {
  render(<App />);
  userEvent.click(screen.getByRole("button"));
  expect(await screen.findByText(/count is 1/i)).toBeInTheDocument();
});
