import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyntaxToggle } from "./SyntaxToggle";
import { useJrdmStore } from "../state/store";

describe("SyntaxToggle", () => {
  beforeEach(() => useJrdmStore.getState().reset());

  it("reflects the store ddlSyntax (sql default selected)", () => {
    render(<SyntaxToggle />);
    expect(screen.getByRole("button", { name: /^SQL\/JSON$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^GraphQL$/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicking GraphQL sets store ddlSyntax", async () => {
    render(<SyntaxToggle />);
    await userEvent.click(screen.getByRole("button", { name: /^GraphQL$/ }));
    expect(useJrdmStore.getState().ddlSyntax).toBe("graphql");
    expect(screen.getByRole("button", { name: /^GraphQL$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
