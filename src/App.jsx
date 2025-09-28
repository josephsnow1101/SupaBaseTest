```jsx
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function App() {
  const [user, setUser] = useState(null)
  const [products, setProducts] = useState([])
  const [name, setName] = useState('')
  const [qty, setQty] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  // =================== FETCH ===================
  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('id')
    if (error) console.error(error)
    setProducts(data ?? [])
  }

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user) setUser(data.session.user)
    }
    getSession()
    fetchProducts()

    // Suscripción realtime
    const channel = supabase
      .channel('realtime:products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          console.log('Cambio detectado:', payload)
          if (payload.eventType === 'INSERT') {
            setProducts((prev) => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setProducts((prev) =>
              prev.map((p) => (p.id === payload.new.id ? payload.new : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setProducts((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // =================== AUTH ===================
  const signIn = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    setLoading(false)
    if (error) return alert(error.message)
    setUser(data.user)
    fetchProducts()
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // =================== CRUD (Optimistic) ===================
  const addProduct = async () => {
    if (!name) return alert('Ingresa un nombre')

    // Optimistic update
    const tempId = Date.now()
    const newProduct = { id: tempId, name, quantity: Number(qty) }
    setProducts((prev) => [...prev, newProduct])

    const { data, error } = await supabase
      .from('products')
      .insert({ name, quantity: Number(qty) })
      .select()

    if (error) {
      console.error(error)
      // rollback
      setProducts((prev) => prev.filter((p) => p.id !== tempId))
      return
    }

    // Reemplazar el temporal por el real
    if (data && data.length > 0) {
      setProducts((prev) =>
        prev.map((p) => (p.id === tempId ? data[0] : p))
      )
    }

    setName('')
    setQty(0)
  }

  const updateQuantity = async (id, change) => {
    const p = products.find((x) => x.id === id)
    if (!p) return

    const newQty = Math.max((p.quantity ?? 0) + change, 0)

    // Optimistic update
    setProducts((prev) =>
      prev.map((prod) =>
        prod.id === id ? { ...prod, quantity: newQty } : prod
      )
    )

    const { error } = await supabase
      .from('products')
      .update({ quantity: newQty })
      .eq('id', id)

    if (error) {
      console.error(error)
      // rollback: recargamos la lista
      fetchProducts()
    }
  }

  const deleteProduct = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return

    // Optimistic update
    const backup = products
    setProducts((prev) => prev.filter((p) => p.id !== id))

    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      console.error(error)
      // rollback
      setProducts(backup)
    }
  }

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
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </div>
        <p>
          Usa el usuario admin que creaste en Supabase Auth:{' '}
          <strong>jsnowoliv@gmail.com</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>📦 Stock en vivo</h1>
      <button onClick={signOut}>🚪 Salir</button>

      {/* Panel de admin */}
      {user.email === 'jsnowoliv@gmail.com' && (
        <div className="row">
          <input
            placeholder="Producto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button onClick={addProduct}>Agregar</button>
        </div>
      )}

      <ul>
        {products.map((p) => (
          <li key={p.id} className="product">
            <span>
              {p.name} ({p.quantity})
            </span>

            {user.email === 'jsnowoliv@gmail.com' && (
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
  )
}
