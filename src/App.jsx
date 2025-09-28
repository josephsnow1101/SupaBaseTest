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

  // =================== FETCH ===================
  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("id");
    if (error) console.error(error);
    else setProducts(data);
  };

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) setUser(data.session.user);
    };
    getSession();
    fetchProducts();

  const channel = supabase
  .channel("realtime:products")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "products" },
    (payload) => {
      console.log("Cambio detectado:", payload);
      if (payload.eventType === "INSERT") {
        setProducts((prev) => {
          // Evitar duplicados (por optimistic update)
          const exists = prev.some((p) => p.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new];
        });
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // =================== CRUD ===================
  const addProduct = async () => {
    if (!name) return alert("Ingresa un nombre");
    if (!arrivalDate) return alert("Ingresa la fecha de llegada");

    // Normalizar fecha a YYYY-MM-DD
    const normalizedDate = new Date(arrivalDate).toISOString().split("T")[0];

    const newProduct = {
      name,
      quantity: Number(qty),
      arrival_date: normalizedDate,
    };

    // Optimistic update
    const tempId = Date.now();
    setProducts((prev) => [...prev, { id: tempId, ...newProduct }]);

    const { data, error } = await supabase
      .from("products")
      .insert(newProduct)
      .select();

    if (error) {
      console.error(error);
      setProducts((prev) => prev.filter((p) => p.id !== tempId)); // rollback
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
      // rollback
      setProducts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, quantity: product.quantity } : p
        )
      );
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;

    const backup = [...products];
    setProducts((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error(error);
      setProducts(backup); // rollback
    }
  };

  // =================== RENDER ===================
  if (!user) {
    return (
      <div className="container">
        <h2>🔑 Admin — iniciar sesión</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button onClick={signIn} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
        <p>
          Usa el usuario admin que creaste en Supabase Auth:{" "}
          <strong>jsnowoliv@gmail.com</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>📦 Stock con Fechas</h1>
      <button onClick={signOut}>🚪 Salir</button>

      {user.email === "jsnowoliv@gmail.com" && (
        <div className="form">
          <input
            placeholder="Producto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            value={qty}
            min="1"
            onChange={(e) => setQty(e.target.value)}
            placeholder="Cantidad"
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
          <li key={p.id} className="product">
            <span>
              <strong>{p.name}</strong> — {p.quantity} 🗓️ {p.arrival_date}
            </span>
            {user.email === "jsnowoliv@gmail.com" && (
              <div className="buttons">
                <button onClick={() => updateQuantity(p.id, +1)}>+1</button>
                <button onClick={() => updateQuantity(p.id, -1)}>-1</button>
                <button onClick={() => deleteProduct(p.id)}>🗑️</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
