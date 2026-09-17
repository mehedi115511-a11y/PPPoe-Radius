import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { LogIn, ShieldCheck, UserRoundCog, X } from "lucide-react";

const request = async (path, options = {}) => {
  const token = localStorage.getItem("pppoe_token");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
};

export function SessionManager() {
  const [session, setSession] = useState(() =>
    JSON.parse(localStorage.getItem("pppoe_user") || "null"),
  );
  const [resellers, setResellers] = useState([]);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const save = (data) => {
    localStorage.setItem("pppoe_token", data.token);
    localStorage.setItem("pppoe_user", JSON.stringify(data.user));
    setSession(data.user);
  };
  const login = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      save(
        await request("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            username: form.get("username"),
            password: form.get("password"),
          }),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const loadResellers = async () => {
    setShow(true);
    setLoading(true);
    setError("");
    try {
      setResellers((await request("/api/admin/resellers")).data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const impersonate = async (id) => {
    setLoading(true);
    setError("");
    try {
      save(await request(`/api/admin/impersonate/${id}`, { method: "POST" }));
      setShow(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  const returnToAdmin = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("/api/auth/exit-impersonation", {
        method: "POST",
      });
      save({
        token: data.token,
        user: { ...session.impersonatedBy, role: "Admin" },
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!session) localStorage.removeItem("pppoe_token");
  }, [session]);

  if (!session)
    return (
      <div className="auth-gate">
        <form className="auth-card" onSubmit={login}>
          <div className="auth-logo">
            <ShieldCheck />
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to PPPoE Radius Integration</p>
          <label>
            Username
            <input
              name="username"
              defaultValue="admin"
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button disabled={loading}>
            <LogIn />
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );

  return (
    <>
      <div
        className={
          session.impersonatedBy
            ? "impersonation-bar active"
            : "impersonation-bar"
        }
      >
        <span>
          <ShieldCheck />
          {session.impersonatedBy ? (
            <>
              <b>Viewing as {session.name}</b>
              <small>Started by {session.impersonatedBy.name}</small>
            </>
          ) : (
            <>
              <b>{session.name}</b>
              <small>Administrator session</small>
            </>
          )}
        </span>
        {session.impersonatedBy ? (
          <button onClick={returnToAdmin} disabled={loading}>
            Return to Admin
          </button>
        ) : (
          <button onClick={loadResellers}>
            <UserRoundCog />
            Login as Reseller
          </button>
        )}
      </div>
      {show && (
        <div className="switcher-backdrop">
          <section className="switcher">
            <header>
              <div>
                <h2>Login as Reseller</h2>
                <p>Open a reseller panel without their password.</p>
              </div>
              <button
                onClick={() => setShow(false)}
                aria-label="Close reseller switcher"
              >
                <X />
              </button>
            </header>
            {error && <div className="auth-error">{error}</div>}
            <div className="reseller-list">
              {loading ? (
                <p>Loading resellers…</p>
              ) : (
                resellers.map((user) => (
                  <article key={user.id}>
                    <span>
                      <b>{user.name}</b>
                      <small>
                        @{user.username} · {user.role}
                      </small>
                    </span>
                    <button onClick={() => impersonate(user.id)}>
                      Open Panel
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

if (typeof document !== "undefined") {
  const mount = document.createElement("div");
  mount.id = "session-manager";
  document.body.appendChild(mount);
  createRoot(mount).render(<SessionManager />);
}
