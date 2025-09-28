// App.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./styles.css";

function App() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [arrivalDate, setArrivalDate] = useState(""); // ⬅️ fecha de llegada

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel("public:products")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        (payload) => {
          console.log("Cambio detectado:", payload);
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from("products").select("*");
    if (error) console.error(error);
    else setProducts(data);
  };

  const addProduct = async () => {
    if (!name) return alert("Ingresa un nombre");
    if (!arrivalDate) return alert("Ingresa la fecha de llegada"); // ⬅️ validación

    const newProduct = {
      name,
      quantity: Number(qty),
      arrival_date: arrivalDate, // ⬅️ guardamos la fecha
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
      // rollback
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
    setArrivalDate(""); // ⬅️ limpiamos el campo
  };

  const deleteProduct = async (id) => {
    if (!confirm("Eliminar este producto?")) return;

    const oldProducts = [...products];
    setProducts((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error(error);
      setProducts(oldProducts); // rollback
    }
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

  return (
    <div className="app">
      <h1>📦 Stock App con Fechas</h1>

      <div className="form">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del producto"
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

      <ul>
        {products.map((item) => (
          <li key={item.id}>
            <span>
              <strong>{item.name}</strong> — {item.quantity} 🗓️{" "}
              {item.arrival_date}
            </span>
            <div className="actions">
              <button onClick={() => updateQuantity(item.id, 1)}>➕</button>
              <button onClick={() => updateQuantity(item.id, -1)}>➖</button>
              <button onClick={() => deleteProduct(item.id)}>🗑️</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
