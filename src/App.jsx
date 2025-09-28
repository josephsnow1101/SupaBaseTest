import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./styles.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [arrivalDate, setArrivalDate] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const isAdmin = user?.email === "jsnowoliv@gmail.com";

  // =================== FETCH ===================
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id");
    if (error) console.error(error);
    else setProducts(data);
  };

  const fetchLogs = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase
      .from("product_logs")
      .select("id, product_id, quantity_change, created_at, user_email")
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    else setLogs(data);
  };

  // =================== EFFECT ===================
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) setUser(data.session.user);
    };
    getSession();
    fetchProducts();
    fetchLogs();

    // Realtime subscription
    const channelProducts = supabase
      .channel("realtime:products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setProducts((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === "DELETE") {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const channelLogs = supabase
      .channel("realtime:logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_logs" },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelProducts);
      supabase.removeChannel(channelLogs);
    };
  }, [user]);

  // =================== AUTH ===================
  const signIn = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setUser(data.user);
    fetchProducts();
    fetchLogs();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // =================== CRUD ===================
  const addProduct = async () => {
    if (!isAdmin) return;
    if (!name) return alert("Ingresa un nombre");
    if (!arrivalDate) return alert("Ingresa la fecha de llegada");

    const newProduct = {
      name,
      quantity: Number(qty),
      arrival_date: arrivalDate,
    };

    const tempId = Date.now();
    setProducts((prev) => [...prev, { id: tempId, ...newProduct }]);

    const { data, error } = await supabase
      .from("products")
      .insert(newProduct)
      .select();

    if (error) {
      console.error(error);
      setProducts((prev) => prev.filter((p) => p.id !== tempId));
      return;
    }

    if (data && data.length > 0) {
      setProducts((prev) =>
        prev.map((p) => (p.id === tempId ? data[0] : p))
      );
    }

    setName("");
    setQty(1);
    setArrivalDate("");
  };

  const updateQuantity = async (id, delta) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const newQty = product.quantity + delta;
    if (newQty < 0) return;

    // Optimistic update
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: newQty } : p))
    );

    const { error } = await supabase
      .from("products")
      .update({ quantity: newQty })
      .eq("id", id);

    if (error) {
      console.error(error);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, quantity: product.quantity } : p
        )
      );
      return;
    }

    // Log the action
    const { error: logError } = await supabase.from("product_logs").insert([
      {
        product_id: id,
        quantity_change: delta,
        user_email: user.email,
      },
    ]);
    if (logError) console.error(logError);
  };

  const deleteProduct = async (id) => {
    if (!isAdmin) return;
    if (!confirm("¿Eliminar este producto?")) return;

    const backup = [...products];
    setProducts((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error(error);
      setProducts(backup);
    }
  };

  // =================== RENDER ===================
  if (!user) {
    return (
      <div className="container">
        <h2>🔑 Iniciar sesión</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={signIn} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>📦 Stock App</h1>
      <button onClick={signOut}>🚪 Salir</button>

      {isAdmin && (
        <div className="form">
          <input
            placeholder="Nombre del producto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <input
            type="date"
            value={arrivalDate}
            onChange={(e) => setArrivalDate(e.target.value)}
          />
          <button onClick={addProduct}>Agregar</button>
        </div>
      )}

      <ul>
        {products.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> — {p.quantity} 🗓️ {p.arrival_date}
            <div className="buttons">
              {(isAdmin || !isAdmin) && (
                <>
                  <button
                    onClick={() =>
                      updateQuantity(p.id, isAdmin ? 1 : -1)
                    }
                  >
                    {isAdmin ? "➕" : "➖"}
                  </button>
                  {!isAdmin && <span>Vendedor solo resta</span>}
                </>
              )}
              {isAdmin && (
                <>
                  <button onClick={() => updateQuantity(p.id, -1)}>➖</button>
                  <button onClick={() => deleteProduct(p.id)}>🗑️</button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="logs">
          <h2>📜 Historial de cambios</h2>
          <ul>
            {logs.map((log) => (
              <li key={log.id}>
                Producto ID {log.product_id} — cambio {log.quantity_change} —{" "}
                Usuario: {log.user_email} — {log.created_at}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
