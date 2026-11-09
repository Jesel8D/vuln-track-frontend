import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { ErrorPanel, Empty, Status, Pagination } from "../../src/components/ui";
import { TextField } from "../../src/components/TextField";
import { ApiError } from "../../src/services/api";
it("exposes status text and native form labels accessibly", () => {
  render(
    <>
      <Status state="needs_review" />
      <TextField
        name="model"
        label="Modelo"
        value=""
        required
        onChange={vi.fn()}
        error="Este campo es obligatorio."
      />
    </>,
  );
  expect(screen.getByText("Requiere revisión")).toBeVisible();
  expect(screen.getByRole("textbox", { name: /Modelo/ })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
    "Este campo es obligatorio.",
  );
});
it("offers a real error recovery action and source reference", async () => {
  const retry = vi.fn();
  const user = userEvent.setup();
  render(
    <ErrorPanel
      error={
        new ApiError(
          503,
          "NVD_UNAVAILABLE",
          "Servicio no disponible",
          "reference",
          3,
        )
      }
      retry={retry}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("reference");
  await user.click(screen.getByRole("button", { name: "Volver a intentar" }));
  expect(retry).toHaveBeenCalledOnce();
});
it("uses server total instead of visible count for pagination", async () => {
  const next = vi.fn();
  const user = userEvent.setup();
  render(<Pagination total={31} offset={0} limit={10} onPage={next} />);
  expect(screen.getByText("1–10 de 31")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Página anterior" }),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Página siguiente" }));
  expect(next).toHaveBeenCalledWith(10);
});
it("renders a useful empty state without false metrics", () => {
  render(
    <MemoryRouter>
      <Empty
        title="Tu inventario empieza aquí"
        text="Registra un activo para continuar."
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Tu inventario empieza aquí" }),
  ).toBeVisible();
});
