import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
import { RegisterPage } from "../../src/pages/RegisterPage";
import { AuthContext } from "../../src/features/auth/context";
import { ApiClient, ApiError } from "../../src/services/api";

const password = "A unique synthetic phrase 7319!";
function view(
  api = new ApiClient("http://127.0.0.1:8000", () => null, vi.fn()),
) {
  render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user: null,
          api,
          login: vi.fn(),
          logout: vi.fn(),
          notice: null,
        }}
      >
        <RegisterPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  return api;
}
async function fill(confirmation = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Usuario"), "New_User");
  await user.type(
    screen.getByLabelText("Contraseña", { exact: true }),
    password,
  );
  await user.type(screen.getByLabelText("Confirmar contraseña"), confirmation);
  return user;
}

it("validates confirmation locally without making a request", async () => {
  const api = view();
  const request = vi.spyOn(api, "registerAccount");
  const user = await fill("Another synthetic phrase 7319!");
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Las contraseñas no coinciden",
  );
  expect(request).not.toHaveBeenCalled();
});

it("waits for server success, normalizes the identifier and clears passwords", async () => {
  const api = view();
  let finish!: (value: { id: string; username: string }) => void;
  const request = vi.spyOn(api, "registerAccount").mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(
    screen.queryByRole("heading", { name: "Cuenta creada" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Creando cuenta…" }),
  ).toBeDisabled();
  expect(request).toHaveBeenCalledWith("new_user", password);
  finish({ id: "b2ea6358-7e13-4bcf-8c10-b85ca2d4c73e", username: "new_user" });
  expect(
    await screen.findByRole("heading", { name: "Cuenta creada" }),
  ).toBeVisible();
  expect(
    screen.queryByLabelText("Contraseña", { exact: true }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Ir a iniciar sesión/ }),
  ).toHaveAttribute("href", "/login");
});

it("shows controlled throttling feedback and clears passwords on failure", async () => {
  const api = view();
  vi.spyOn(api, "registerAccount").mockRejectedValue(
    new ApiError(
      429,
      "REGISTRATION_RATE_LIMIT",
      "Espera antes de reintentar",
      undefined,
      60,
    ),
  );
  const user = await fill();
  await user.click(screen.getByRole("button", { name: "Mostrar contraseñas" }));
  expect(screen.getByLabelText("Contraseña", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("60 segundos");
  expect(screen.getByLabelText("Contraseña", { exact: true })).toHaveValue("");
  expect(screen.getByLabelText("Confirmar contraseña")).toHaveValue("");
  expect(
    screen.queryByRole("heading", { name: "Cuenta creada" }),
  ).not.toBeInTheDocument();
});

it("uses the existing HTTP client anonymously without sending confirmation or roles", async () => {
  const request = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "b2ea6358-7e13-4bcf-8c10-b85ca2d4c73e",
        username: "normal",
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", request);
  try {
    const api = new ApiClient(
      "http://127.0.0.1:8000",
      () => "never-send-this",
      vi.fn(),
    );
    await api.registerAccount("normal", password);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:8000/api/v1/auth/register");
    expect(JSON.parse(options.body)).toEqual({ username: "normal", password });
    expect(options.headers.Authorization).toBeUndefined();
    expect(options.credentials).toBe("omit");
  } finally {
    vi.unstubAllGlobals();
  }
});

it("rejects a successful HTTP body that does not match the public identity contract", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "bad", username: "normal", role: "admin" }),
          { status: 201 },
        ),
      ),
  );
  try {
    const api = new ApiClient("http://127.0.0.1:8000", () => null, vi.fn());
    await expect(api.registerAccount("normal", password)).rejects.toMatchObject(
      { code: "INVALID_RESPONSE" },
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
