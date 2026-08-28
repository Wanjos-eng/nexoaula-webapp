import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("identifica a fundação do frontend do nexoAula", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Fundação do frontend pronta para evoluir.",
      }),
    ).toBeDefined();
  });
});
