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
  const [modal, setModal] = useState({ open: false, type: "", productId: null });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [productToReduce, setProductToReduce] = useState(null);

  const isAdmin = user?.email?.toLowerCase() === "jsnowoliv@gmail.com";

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
    const { data, error } = await supabase
      .from("product_logs")
      .select(`
        id,
        quantity_change,
        created_at,
        user_email,
        product_id,
        products:products(name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al obtener logs:", error);
    } else {
      setLogs(data);
    }
  };

  // =================== EXPORT ===================
  const filterProductsByDate = () => {
    if (!fromDate || !toDate) return products;

    return products.filter((p) => {
      if (!p.arrival_date) return false;
      const d = new Date(p.arrival_date);
      return d >= new Date(fromDate) && d <= new Date(toDate);
    });
  };

  const exportToCSV = () => {
    const filtered = filterProductsByDate();
    if (filtered.length === 0) return alert("No hay productos en ese rango.");

    const headers = ["ID", "Nombre", "Cantidad", "Fecha de llegada"];
    const rows = filtered.map((p) => [p.id, p.name, p.quantity, p.arrival_date]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos.csv";
    a.click();
  };

  const exportToPDF = () => {
    const filtered = filterProductsByDate();
    if (filtered.length === 0) return alert("No hay productos en ese rango.");

    const printWindow = window.open("", "_blank");
    const html = `
      <html>
        <head>
          <title>Reporte de productos</title>
          <style>
            body { font-family: Arial, sans-serif; }
            h2 { margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Reporte de productos</h2>
          <table>
            <thead>
              <tr><th>ID</th><th>Nombre</th><th>Cantidad</th><th>Fecha de llegada</th></tr>
            </thead>
            <tbody>
              ${filtered
                .map(
                  (p) =>
                    `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.quantity}</td><td>${p.arrival_date}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  // ======= Vendedor: abrir popup =======
  const handleReduceClick = (product) => {
    setProductToReduce(product);
    setShowConfirm(true);
  };

  // ======= Confirmar la acción =======
  const confirmReduce = async () => {
    if (!productToReduce) return;

    const newQuantity = productToReduce.quantity - 1;
    if (newQuantity < 0) return alert("No puedes tener cantidades negativas.");

    const { error } = await supabase
      .from("products")
      .update({ quantity: newQuantity })
      .eq("id", productToReduce.id);

    if (!error) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productToReduce.id ? { ...p, quantity: newQuantity } : p
        )
      );
    }

    setShowConfirm(false);
    setProductToReduce(null);
  };

  const cancelReduce = () => {
    setShowConfirm(false);
    setProductToReduce(null);
  };

  // =================== EFFECT ===================
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setUser(data.session.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    fetchProducts();
    fetchLogs();

    // Realtime Products
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

    // Realtime Logs mejorado
    const channelLogs = supabase
      .channel("realtime:logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_logs" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLogs((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === "DELETE") {
            setLogs((prev) => prev.filter((log) => log.id !== payload.old.id));
          } else {
            fetchLogs();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channelProducts);
      supabase.removeChannel(channelLogs);
      authListener.subscription.unsubscribe();
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

    const { data, error } = await supabase
      .from("products")
      .insert(newProduct)
      .select();

    if (error) return alert(error.message);
    if (data && data.length > 0) setProducts((prev) => [...prev, data[0]]);

    setName("");
    setQty(1);
    setArrivalDate("");
  };

  const updateQuantity = async (id, delta) => {
    const product = products.find((p) => p.id === id);
    if (!product) return;

    const newQty = Number(product.quantity) + Number(delta);
    if (newQty < 0) return;

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

    const { error: logError } = await supabase.from("product_logs").insert([
      {
        product_id: id,
        quantity_change: delta,
        user_email: user.email,
      },
    ]);
    if (logError) console.error(logError);
  };

  const deleteProduct = (id) => {
    if (!isAdmin) return;
    setModal({ open: true, type: "confirm-delete", productId: id });
  };

  const confirmDelete = async () => {
    const id = modal.productId;
    const backup = [...products];
    setProducts((prev) => prev.filter((p) => p.id !== id));

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      console.error(error);
      setProducts(backup);
    }
    setModal({ open: false, type: "", productId: null });
  };

  const closeModal = () => {
    setModal({ open: false, type: "", productId: null });
  };

  const clearLogs = async () => {
    const { error } = await supabase.from("product_logs").delete().gte("id", 0);

    if (error) {
      console.error("Error al borrar historial:", error);
    } else {
      setLogs([]);
    }
  };

  // =================== LOGIN VIEW ===================
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

  // =================== MODAL ===================
  const renderModal = () => {
    if (!modal.open || !isAdmin) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          {modal.type === "confirm-delete" && (
            <>
              <h3>⚠️ Confirmar eliminación</h3>
              <p>¿Seguro que deseas eliminar este producto?</p>
              <div className="modal-buttons">
                <button onClick={closeModal}>Cancelar</button>
                <button onClick={confirmDelete}>Eliminar</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // =================== MAIN VIEW ===================
  return (
    <div className="container">
      {renderModal()}

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

      {isAdmin && (
        <div className="export-section">
          <h3>📤 Exportar productos</h3>
          <label>Desde: </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <label>Hasta: </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          <button onClick={exportToCSV}>📊 Exportar a CSV</button>
          <button onClick={exportToPDF}>📄 Exportar a PDF</button>
        </div>
      )}

      <ul>
        {products.map((p) => (
          <li key={p.id}>
            <strong>{p.name}</strong> — {p.quantity} 🗓️ {p.arrival_date}
            <div className="buttons">
              {isAdmin && (
                <>
                  <button onClick={() => updateQuantity(p.id, 1)}>➕</button>
                  <button onClick={() => updateQuantity(p.id, -1)}>➖</button>
                  <button onClick={() => deleteProduct(p.id)}>🗑️</button>
                </>
              )}

              {!isAdmin && (
                <button onClick={() => handleReduceClick(p)}>➖</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <div className="logs-container">
          <div className="logs-header">
            <h2>📜 Historial de cambios</h2>
            <button className="clear-logs-btn" onClick={clearLogs}>
              Borrar historial
            </button>
          </div>
          <ul className="logs-list">
            {logs.map((log) => (
              <li key={log.id} className="log-item">
                <span className="log-user">{log.user_email}</span>
                <span className="log-product">
                  {log.products?.name || "Producto desconocido"}
                </span>
                <span className="log-date">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 📌 Modal de confirmación para vendedores */}
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>⚠️ Confirmar acción</h3>
            <p>
              ¿Seguro que deseas restar 1 a{" "}
              <strong>{productToReduce?.name}</strong>?
            </p>
            <div className="modal-buttons">
              <button onClick={cancelReduce}>Cancelar</button>
              <button onClick={confirmReduce}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
