// App.jsx
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
    else setProducts(data ?? []);
  };

  // =================== SESSION + REALTIME ===================
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) setUser(data.session.user);
    };
    getSession();
    fetchProducts();

    const channel = supabase
      .channel("public:products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          // Actualización en vivo
          if (payload.eventType === "INSERT") {
            setProducts((prev) => [...prev, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            );
          } else if (payload.eventType === "DELETE") {
            setProducts((prev) =>
              prev.filter((p) => p.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // =================== AUTH ===================
  const signIn = async () => {
    if (!email || !password) return alert("Ingresa email y contraseña");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setUser(data.user);
    fetchProducts();
    setPassword(""); // limpia password del estado
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const isAdmin = user?.email === "jsnowoliv@gmail.com";

  // =================== CRUD OPTIMISTIC ===================
  const addProduct = async () => {
    if (!name) return alert("Ingresa un nombre");
    if (!arrivalDate) return alert("Ingresa la fecha de llegada");

    const normalizedDate = new Date(arrivalDate).toISOString().split("T")[0];
    const newProduct = { name, quantity: Number(qty), arrival_date: normalizedDate };

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
        <h2>🔑 Iniciar sesión</h2>
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
        <button onClick={signIn} disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>📦 Stock App con Fechas</h1>
      <button onClick={signOut}>🚪 Salir</button>

      {isAdmin && (
        <div className="form">
          <input
            placeholder="Producto"
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
          <li key={p.id} className="product">
            <span>
              <strong>{p.name}</strong> — {p.quantity} 🗓️ {p.arrival_date}
            </span>

            <div className="buttons">
              {(isAdmin || !isAdmin) && (
                <button
                  onClick={() => updateQuantity(p.id, -1)}
                  disabled={p.quantity <= 0 || isAdmin === false}
                  title="Restar producto"
                >
                  ➖
                </button>
              )}

              {isAdmin && (
                <>
                  <button onClick={() => updateQuantity(p.id, +1)}>➕</button>
                  <button onClick={() => deleteProduct(p.id)}>🗑️</button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
