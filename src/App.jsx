import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

  // Modales y UI
  const [modal, setModal] = useState({ open: false, type: "", productId: null });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Confirmación para vendedores (cantidad personalizada)
  const [showConfirm, setShowConfirm] = useState(false);
  const [productToReduce, setProductToReduce] = useState(null);
  const [reduceAmount, setReduceAmount] = useState(1);

  // Edición inline de producto
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");

  // Historial individual de producto
  const [productHistoryOpen, setProductHistoryOpen] = useState(false);
  const [historyForProduct, setHistoryForProduct] = useState(null); // {id, name}
  const [historyLogs, setHistoryLogs] = useState([]);

  // Export logs (rango de fechas independiente del de productos)
  const [fromLogDate, setFromLogDate] = useState("");
  const [toLogDate, setToLogDate] = useState("");

  const isAdmin = user?.email?.toLowerCase() === "jsnowoliv@gmail.com";

  // =================== FETCH ===================
  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,quantity,arrival_date")
      .order("id");
    if (error) console.error(error);
    else setProducts(data || []);
  }, []);

  const fetchLogs = useCallback(async () => {
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
      setLogs(data || []);
    }
  }, []);

  const fetchLogsForProduct = useCallback(async (productId) => {
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
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error al obtener logs del producto:", error);
    } else {
      setHistoryLogs(data || []);
    }
  }, []);

  // =================== EXPORT: Productos ===================
  const filterProductsByDate = () => {
    if (!fromDate && !toDate) return products;
    return products.filter((p) => {
      if (!p.arrival_date) return false;
      const d = new Date(p.arrival_date);
      const from = fromDate ? new Date(fromDate) : new Date("1900-01-01");
      const to = toDate ? new Date(toDate) : new Date("9999-12-31");
      return d >= from && d <= to;
    });
  };

  const exportProductsToCSV = () => {
    const filtered = filterProductsByDate();
    if (filtered.length === 0) return alert("No hay productos en ese rango.");
    const headers = ["ID", "Nombre", "Cantidad", "Fecha de llegada"];
    const rows = filtered.map((p) => [p.id, p.name, p.quantity, p.arrival_date || ""]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "productos.csv";
    a.click();
  };

  const exportProductsToPDF = () => {
    const filtered = filterProductsByDate();
    if (filtered.length === 0) return alert("No hay productos en ese rango.");
    const printWindow = window.open("", "_blank");
    const html = `
      <html>
        <head>
          <title>Reporte de productos</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
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
                    `<tr><td>${p.id}</td><td>${p.name}</td><td>${p.quantity}</td><td>${p.arrival_date || ""}</td></tr>`
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

  // =================== EXPORT: Logs ===================
  const filteredLogs = useMemo(() => {
    if (!fromLogDate && !toLogDate) return logs;
    const from = fromLogDate ? new Date(fromLogDate) : new Date("1900-01-01");
    const to = toLogDate ? new Date(toLogDate) : new Date("9999-12-31");
    return logs.filter((l) => {
      const d = new Date(l.created_at);
      return d >= from && d <= to;
    });
  }, [logs, fromLogDate, toLogDate]);

  const exportLogsToCSV = () => {
    if (filteredLogs.length === 0) return alert("No hay logs en ese rango.");
    const headers = ["ID", "Producto", "Cambio", "Usuario", "Fecha"];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.products?.name || `#${l.product_id} (eliminado)`,
      l.quantity_change,
      l.user_email,
      new Date(l.created_at).toLocaleString(),
    ]);
    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "logs.csv";
    a.click();
  };

  const exportLogsToPDF = () => {
    if (filteredLogs.length === 0) return alert("No hay logs en ese rango.");
    const printWindow = window.open("", "_blank");
    const html = `
      <html>
        <head>
          <title>Historial de cambios</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h2 { margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #000; padding: 6px; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Historial de cambios</h2>
          <table>
            <thead>
              <tr><th>ID</th><th>Producto</th><th>Cambio</th><th>Usuario</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              ${filteredLogs
                .map(
                  (l) =>
                    `<tr>
                      <td>${l.id}</td>
                      <td>${l.products?.name || `#${l.product_id} (eliminado)`}</td>
                      <td>${l.quantity_change}</td>
                      <td>${l.user_email}</td>
                      <td>${new Date(l.created_at).toLocaleString()}</td>
                    </tr>`
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

  // ======= Vendedor: abrir popup (cantidad) =======
  const handleReduceClick = (product) => {
    setProductToReduce(product);
    setReduceAmount(1);
    setShowConfirm(true);
  };

  // ======= Confirmar la acción (resta personalizada) =======
  const confirmReduce = async () => {
    if (!productToReduce) return;
    const amount = Math.max(1, parseInt(reduceAmount || 1, 10));
    const newQuantity = Number(productToReduce.quantity) - amount;
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
      // Log de resta (vendedor o admin)
      await supabase.from("product_logs").insert([
        {
          product_id: productToReduce.id,
          quantity_change: -amount,
          user_email: user.email,
        },
      ]);
    } else {
      console.error(error);
    }

    setShowConfirm(false);
    setProductToReduce(null);
    setReduceAmount(1);
  };

  const cancelReduce = () => {
    setShowConfirm(false);
    setProductToReduce(null);
    setReduceAmount(1);
  };

  // =================== EFFECT ===================
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setUser(data.session.user);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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

    // Realtime Logs (enriquecemos con nombre si lo tenemos en memoria)
    const channelLogs = supabase
      .channel("realtime:logs")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_logs" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const prod = products.find((p) => p.id === payload.new.product_id);
            const enriched = prod
              ? { ...payload.new, products: { name: prod.name } }
              : payload.new;
            setLogs((prev) => [enriched, ...prev]);
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
  }, [fetchLogs, fetchProducts, products]);

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
    if (data && data.length > 0) {
      setProducts((prev) => [...prev, data[0]]);
      await supabase.from("product_logs").insert([
        {
          product_id: data[0].id,
          quantity_change: newProduct.quantity, // alta inicial
          user_email: user.email,
        },
      ]);
    }

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

    await supabase.from("product_logs").insert([
      {
        product_id: id,
        quantity_change: delta,
        user_email: user.email,
      },
    ]);
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
    } else {
      // Nota: mantenemos el esquema actual: usar -9999 como simbólico
      await supabase.from("product_logs").insert([
        {
          product_id: id,
          quantity_change: -9999, // simbólico = eliminado
          user_email: user.email,
        },
      ]);
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

  // =================== EDITAR NOMBRE/FECHA ===================
  const startEdit = (p) => {
    setEditId(p.id);
    setEditName(p.name);
    setEditDate(p.arrival_date || "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditName("");
    setEditDate("");
  };

  const saveEdit = async () => {
    if (!isAdmin || !editId) return;
    if (!editName) return alert("El nombre no puede estar vacío");
    if (!editDate) return alert("La fecha no puede estar vacía");

    const { error } = await supabase
      .from("products")
      .update({ name: editName, arrival_date: editDate })
      .eq("id", editId);

    if (error) {
      console.error(error);
      return;
    }

    setProducts((prev) =>
      prev.map((p) =>
        p.id === editId ? { ...p, name: editName, arrival_date: editDate } : p
      )
    );

    // Logueamos edición con quantity_change = 0
    await supabase.from("product_logs").insert([
      {
        product_id: editId,
        quantity_change: 0,
        user_email: user.email,
      },
    ]);

    cancelEdit();
  };

  // =================== DASHBOARD: totales y bajo stock ===================
  const totalProducts = products.length;
  const totalUnits = useMemo(
    () => products.reduce((acc, p) => acc + Number(p.quantity || 0), 0),
    [products]
  );

  const topN = 10;
  const topProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => b.quantity - a.quantity);
    return sorted.slice(0, topN);
  }, [products]);

  const lowCount = 3; // cuántos mostrar en "menos stock"
  const lowStockProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => a.quantity - b.quantity);
    return sorted.slice(0, Math.min(lowCount, sorted.length));
  }, [products]);

  // =================== CHART.JS (CDN) ===================
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const ensureChartJsAndRender = useCallback(() => {
    const render = () => {
      if (!canvasRef.current) return;

      // destruir instancia previa si existe
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const labels = topProducts.map((p) =>
        p.name.length > 18 ? p.name.slice(0, 18) + "…" : p.name
      );
      const data = topProducts.map((p) => Number(p.quantity || 0));

      const ctx = canvasRef.current.getContext("2d");
      chartRef.current = new window.Chart(ctx, {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Cantidad",
              data,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: `Top ${topProducts.length} por stock` },
          },
          scales: {
            x: { ticks: { autoSkip: true, maxTicksLimit: 10 } },
            y: { beginAtZero: true, precision: 0 },
          },
        },
      });
    };

    if (!window.Chart) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/chart.js";
      script.async = true;
      script.onload = render;
      document.body.appendChild(script);
    } else {
      render();
    }
  }, [topProducts]);

  useEffect(() => {
    ensureChartJsAndRender();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [ensureChartJsAndRender]);

  // =================== HISTORIAL POR PRODUCTO ===================
  const openHistoryForProduct = async (p) => {
    setHistoryForProduct({ id: p.id, name: p.name });
    setProductHistoryOpen(true);
    await fetchLogsForProduct(p.id);
  };

  const closeHistory = () => {
    setProductHistoryOpen(false);
    setHistoryForProduct(null);
    setHistoryLogs([]);
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

  // =================== MODALES ===================
  const renderAdminModal = () => {
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

  const renderSellerConfirm = () => {
    if (!showConfirm) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <h3>⚠️ Confirmar acción</h3>
          <p>
            ¿Cuánto deseas restar a <strong>{productToReduce?.name}</strong>?
          </p>
          <input
            type="number"
            min="1"
            value={reduceAmount}
            onChange={(e) => setReduceAmount(e.target.value)}
          />
          <div className="modal-buttons">
            <button onClick={cancelReduce}>Cancelar</button>
            <button onClick={confirmReduce}>Confirmar</button>
          </div>
        </div>
      </div>
    );
  };

  const renderProductHistory = () => {
    if (!productHistoryOpen) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-box" style={{ maxWidth: 700 }}>
          <h3>📜 Historial — {historyForProduct?.name}</h3>
          <div className="logs-list" style={{ maxHeight: 360, overflowY: "auto" }}>
            {historyLogs.length === 0 && <p>Sin movimientos.</p>}
            {historyLogs.map((log) => (
              <div key={log.id} className="log-item">
                <span className="log-user">{log.user_email}</span>
                <span className="log-product">
                  {log.products?.name || "Producto eliminado"}
                </span>
                <span className="log-change">
                  {Number(log.quantity_change) > 0 ? `+${log.quantity_change}` : log.quantity_change}
                </span>
                <span className="log-date">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="modal-buttons">
            <button onClick={closeHistory}>Cerrar</button>
          </div>
        </div>
      </div>
    );
  };

  // =================== MAIN VIEW ===================
  return (
    <div className="container">
      {renderAdminModal()}
      {renderSellerConfirm()}
      {renderProductHistory()}

      <h1>📦 Stock App</h1>
      <button onClick={signOut}>🚪 Salir</button>

      {/* DASHBOARD — ORDEN EXACTO */}
      <div className="chart-wrapper" style={{ background: "#2C3A2A", padding: "1rem", borderRadius: 10, marginTop: "1rem" }}>
        <canvas ref={canvasRef} height="220" />
      </div>

      <div className="dashboard" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
        <div className="card" style={{ background: "#E7D6B1", color: "#171515", borderRadius: 10, padding: "12px" }}>
          <div className="metric" style={{ opacity: 0.8 }}>Unidades totales</div>
          <div className="value" style={{ fontSize: "1.4rem", fontWeight: "bold" }}>{totalUnits}</div>
        </div>
        <div className="card" style={{ background: "#E7D6B1", color: "#171515", borderRadius: 10, padding: "12px" }}>
          <div className="metric" style={{ opacity: 0.8 }}>Total de productos</div>
          <div className="value" style={{ fontSize: "1.4rem", fontWeight: "bold" }}>{totalProducts}</div>
        </div>
      </div>

      <div className="low-stock" style={{ background: "#2C3A2A", marginTop: "12px", padding: "12px", borderRadius: 10 }}>
        <h2 style={{ marginBottom: "8px" }}>📉 Productos con menos stock</h2>
        {lowStockProducts.length === 0 ? (
          <p>No hay productos.</p>
        ) : (
          <ul>
            {lowStockProducts.map((p) => (
              <li key={p.id} className="product" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{p.name}</span>
                <span>{p.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Alta */}
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

      {/* Exportación de productos */}
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
          <button onClick={exportProductsToCSV}>📊 CSV</button>
          <button onClick={exportProductsToPDF}>📄 PDF</button>
        </div>
      )}

      {/* Lista de productos */}
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {editId === p.id ? (
              <div className="edit-row">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nombre"
                />
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
                <div className="buttons">
                  <button onClick={cancelEdit}>Cancelar</button>
                  <button onClick={saveEdit}>Guardar</button>
                </div>
              </div>
            ) : (
              <>
                <strong>{p.name}</strong> — {p.quantity} 🗓️ {p.arrival_date || "—"}
                <div className="buttons">
                  <button onClick={() => openHistoryForProduct(p)}>📜 Historial</button>
                  {isAdmin ? (
                    <>
                      <button onClick={() => updateQuantity(p.id, 1)}>➕</button>
                      <button onClick={() => handleReduceClick(p)}>➖ Cant.</button>
                      <button onClick={() => startEdit(p)}>✏️ Editar</button>
                      <button onClick={() => deleteProduct(p.id)}>🗑️</button>
                    </>
                  ) : (
                    <button onClick={() => handleReduceClick(p)}>➖ Restar</button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {/* Logs globales */}
      {isAdmin && (
        <div className="logs-container">
          <div className="logs-header">
            <h2>📜 Historial de cambios</h2>
            <div className="logs-actions">
              <label>Desde</label>
              <input
                type="date"
                value={fromLogDate}
                onChange={(e) => setFromLogDate(e.target.value)}
              />
              <label>Hasta</label>
              <input
                type="date"
                value={toLogDate}
                onChange={(e) => setToLogDate(e.target.value)}
              />
              <button onClick={exportLogsToCSV}>📊 CSV</button>
              <button onClick={exportLogsToPDF}>📄 PDF</button>
              <button className="clear-logs-btn" onClick={clearLogs}>
                Borrar historial
              </button>
            </div>
          </div>
          <ul className="logs-list">
            {filteredLogs.map((log) => (
              <li key={log.id} className="log-item">
                <span className="log-user">{log.user_email}</span>
                <span className="log-product">
                  {log.products?.name || "Producto eliminado"}
                </span>
                <span className="log-change">
                  {Number(log.quantity_change) > 0 ? `+${log.quantity_change}` : log.quantity_change}
                </span>
                <span className="log-date">
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
