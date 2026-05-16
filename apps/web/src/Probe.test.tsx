import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Probe } from "./Probe";

describe("Probe", () => {
  it("renders its label", () => {
    render(<Probe label="harness-ok" />);
    expect(screen.getByText("harness-ok")).toBeInTheDocument();
  });
});
