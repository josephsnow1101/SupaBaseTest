// App.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

function App() {
  const [stocks, setStocks] = useState([]);
  const [newProduct, setNewProduct] = useState('');

  useEffect(() => {
    fetchStocks();

    const channel = supabase
      .channel('public:stocks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stocks' },
        (payload) => {
          console.log('Cambio detectado:', payload);
          fetchStocks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchStocks() {
    const { data, error } = await supabase
      .from('stocks')
      .select('*')
      .order('id');
    if (error) console.error(error);
    else setStocks(data);
  }

  async function addProduct() {
    if (!newProduct) return;

    const { data: existing, error } = await supabase
      .from('stocks')
      .select('*')
      .eq('name', newProduct)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(error);
      return;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('stocks')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id);

      if (updateError) console.error(updateError);
    } else {
      const { error: insertError } = await supabase
        .from('stocks')
        .insert([{ name: newProduct, quantity: 1 }]);

      if (insertError) console.error(insertError);
    }

    setNewProduct('');
  }

  async function updateQuantity(id, newQty) {
    if (newQty < 0) return; // evita negativos
    const { error } = await supabase
      .from('stocks')
      .update({ quantity: newQty })
      .eq('id', id);

    if (error) console.error(error);
  }

  async function deleteProduct(id) {
    const { error } = await supabase.from('stocks').delete().eq('id', id);
    if (error) console.error(error);
  }

  return (
    <div>
      <h1>📦 Supabase Stock App</h1>
      <input
        value={newProduct}
        onChange={(e) => setNewProduct(e.target.value)}
        placeholder="Nombre del producto"
      />
      <button onClick={addProduct}>Agregar</button>

      <ul>
        {stocks.map((item) => (
          <li key={item.id}>
            {item.name} — {item.quantity}{' '}
            <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
              ➕
            </button>
            <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
              ➖
            </button>
            <button onClick={() => deleteProduct(item.id)}>🗑️</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
