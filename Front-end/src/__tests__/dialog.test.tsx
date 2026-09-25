import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui/Dialog";

function Host({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  return (
    <>
      <button data-testid="origin" type="button">
        Origem
      </button>
      {open ? (
        <Dialog onClose={onClose} titleId="dialog-title">
          <h2 id="dialog-title">Editar dados</h2>
          <input aria-label="Campo editável" />
        </Dialog>
      ) : null}
    </>
  );
}

it("mantém o foco estável em rerenders e usa o callback de fechamento mais recente", () => {
  const firstClose = vi.fn();
  const latestClose = vi.fn();
  const view = render(<Host onClose={firstClose} open={false} />);

  const origin = screen.getByTestId("origin");
  origin.focus();

  view.rerender(<Host onClose={firstClose} open />);
  const field = screen.getByLabelText("Campo editável");
  field.focus();

  view.rerender(<Host onClose={latestClose} open />);
  expect(document.activeElement).toBe(field);

  fireEvent.keyDown(document, { key: "Escape" });
  expect(firstClose).not.toHaveBeenCalled();
  expect(latestClose).toHaveBeenCalledTimes(1);

  view.rerender(<Host onClose={latestClose} open={false} />);
  expect(document.activeElement).toBe(origin);
});
