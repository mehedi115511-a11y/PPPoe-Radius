import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, test } from "vitest";
import { App } from "./main.jsx";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => cleanup());

test("switches to minimal reseller dashboard", async () => {
  render(<App />);
  await userEvent.selectOptions(
    screen.getByLabelText("Preview user role"),
    "Reseller",
  );
  expect(
    screen.getByRole("heading", { name: "Reseller Dashboard" }),
  ).toBeInTheDocument();
  expect(screen.getByText("486")).toBeInTheDocument();
  expect(screen.getByText("328")).toBeInTheDocument();
  expect(screen.getByText("124")).toBeInTheDocument();
  expect(screen.getByText("34")).toBeInTheDocument();
});

test("opens clients and filters expired accounts", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Clients" }));
  expect(screen.getByRole("heading", { name: "Clients" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Expired" }));
  expect(screen.getByText("Mim Enterprise")).toBeInTheDocument();
  expect(screen.queryByText("Rahim Home")).not.toBeInTheDocument();
});

test("searches clients by username", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Clients" }));
  await userEvent.type(
    screen.getByPlaceholderText("Search name, username or mobile"),
    "hasan-office",
  );
  expect(screen.getByText("Hasan Office")).toBeInTheDocument();
  expect(screen.queryByText("Saifan Net 1021")).not.toBeInTheDocument();
});

test("opens the add client form", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Clients" }));
  await userEvent.click(screen.getByRole("button", { name: "Add Client" }));
  expect(
    screen.getByRole("heading", { name: "Add Client" }),
  ).toBeInTheDocument();
  const modal = screen
    .getByRole("heading", { name: "Add Client" })
    .closest("form");
  expect(within(modal).getByLabelText("Username")).toBeRequired();
  expect(within(modal).getByLabelText("PPPoE Password")).toBeRequired();
  expect(within(modal).getByLabelText("Expiry Date")).toHaveAttribute(
    "type",
    "date",
  );
});

test("opens the package management form", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Packages" }));
  await userEvent.click(screen.getByRole("button", { name: "Add Package" }));
  const modal = screen
    .getByRole("heading", { name: "Add Package" })
    .closest("form");
  expect(within(modal).getByLabelText("Package Name")).toBeRequired();
  expect(within(modal).getByLabelText("Download Mbps")).toHaveAttribute(
    "min",
    "1",
  );
});
