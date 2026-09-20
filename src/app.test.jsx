import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
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
test("IP Pools menu opens tenant pool form inside dashboard", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "IP Pools" }));
  expect(screen.getByRole("heading", { name: "IP Pools" })).toBeInTheDocument();
  expect(screen.getByText(/does not configure a MikroTik router/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Add IP Pool" }));
  const modal=screen.getByRole("heading", { name: "Add IP Pool" }).closest("form");
  expect(within(modal).getByLabelText("Pool Name")).toBeRequired();
  expect(within(modal).getByLabelText("IPv4 Network (CIDR)")).toBeRequired();
  expect(within(modal).getByRole("button", { name: "Save IP Pool" })).toBeInTheDocument();
});
test("saving an IP pool sends the API request and displays the returned pool", async () => {
  let created=false;
  const fetchMock=vi.spyOn(globalThis,"fetch").mockImplementation(async(path,options={})=>{
    if(path==="/api/ip-pools"&&options.method==="POST"){
      expect(JSON.parse(options.body)).toEqual({name:"Client pool",network:"10.20.0.0/24",status:"Active"});
      created=true;
      return {ok:true,status:201,json:async()=>({data:{id:1,name:"Client pool",network:"10.20.0.0/24",status:"Active"}})};
    }
    if(path==="/api/ip-pools")return {ok:true,status:200,json:async()=>({data:created?[{id:1,name:"Client pool",network:"10.20.0.0/24",status:"Active"}]:[]})};
    throw new Error("Unexpected request: "+path);
  });
  try{
    render(<App />);
    await userEvent.click(screen.getByRole("button",{name:"IP Pools"}));
    await screen.findByText("No IP pools yet.");
    await userEvent.click(screen.getByRole("button",{name:"Add IP Pool"}));
    await userEvent.type(screen.getByLabelText("Pool Name"),"Client pool");
    await userEvent.type(screen.getByLabelText("IPv4 Network (CIDR)"),"10.20.0.0/24");
    await userEvent.click(screen.getByRole("button",{name:"Save IP Pool"}));
    await waitFor(()=>expect(screen.getByText("10.20.0.0/24")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/ip-pools",expect.objectContaining({method:"POST"}));
  }finally{fetchMock.mockRestore()}
});
test("opens dedicated VPN workspace with RouterOS 6 and 7 selection", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "VPN" }));
  expect(screen.getByRole("heading", { name: "VPN" })).toBeInTheDocument();
  const selector=screen.getByLabelText("RouterOS Version");
  expect(selector).toHaveValue("7");
  expect(within(selector).getByRole("option", { name: /RouterOS 6/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create VPN & Script" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check CHR" })).toBeInTheDocument();
});

test("opens billing with full cycle and custom day modes", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Quick Recharge" }));
  expect(screen.getByRole("heading", { name: "Billing" })).toBeInTheDocument();
  const mode = screen.getByLabelText("Recharge mode");
  expect(mode).toHaveValue("full_cycle");
  await userEvent.selectOptions(mode, "custom_days");
  expect(screen.getByLabelText("Selected days")).toHaveAttribute("min", "1");
});

test("opens reseller account creation with password validation", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Resellers" }));
  expect(screen.getByRole("heading", { name: "Add Reseller" })).toBeInTheDocument();
  expect(within(screen.getByRole("heading", { name: "Add Reseller" }).closest("section")).getByLabelText("Password")).toHaveAttribute("minLength", "12");
  expect(screen.getByRole("button", { name: "Create Reseller" })).toBeInTheDocument();
});

test("reseller workspace offers sub-reseller creation", async () => {
  render(<App />);
  await userEvent.selectOptions(screen.getByLabelText("Preview user role"), "Reseller");
  await userEvent.click(screen.getByRole("button", { name: "Resellers" }));
  expect(screen.getByRole("heading", { name: "Add Sub-reseller" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create Sub-reseller" })).toBeInTheDocument();
});

test("authenticated reseller session selects the reseller workspace", async () => {
  render(<App />);
  act(() => window.dispatchEvent(new CustomEvent("pppoe:session", { detail: { role: "Reseller" } })));
  await userEvent.click(screen.getByRole("button", { name: "Resellers" }));
  expect(screen.getByRole("heading", { name: "Add Sub-reseller" })).toBeInTheDocument();
});

test("wallet page labels payment evidence as non-crediting", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Wallet & Ledger" }));
  expect(screen.getByRole("heading", { name: "Submit payment evidence" })).toBeInTheDocument();
  expect(screen.getByText("Submission and review do not credit your wallet.")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Review payment evidence" })).toBeInTheDocument();
});
