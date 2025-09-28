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

  // Carga inicial
  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('id')
    setProducts(data ?? [])
  }

  useEffect(() => {
    // Mantener sesión si ya hay user
    const getSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session?.user) setUser(data.session.user)
    }
    getSession()
    fetchProducts()

    // Suscripción en vivo (Postgres Changes)
    const channel = supabase
      .channel('realtime:products')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        (payload) => {
          // Para simplicidad, re-fetch completo en cada cambio.
          fetchProducts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

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

  const addProduct = async () => {
    if (!name) return alert('Ingresa un nombre')
    await supabase.from('products').insert({ name, quantity: Number(qty) })
    setName('')
    setQty(0)
  }

  const updateQuantity = async (id, change) => {
    const p = products.find((x) => x.id === id)
    const newQty = Math.max((p?.quantity ?? 0) + change, 0)
    await supabase.from('products').update({ quantity: newQty }).eq('id', id)
  }

  const deleteProduct = async (id) => {
    if (!confirm('Eliminar este producto?')) return
    await supabase.from('products').delete().eq('id', id)
  }

  if (!user) {
    return (
      <div className="container">
        <h2>Admin — iniciar sesión</h2>
        <input placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <div style={{marginTop:8}}>
          <button onClick={signIn} disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </div>
        <p>Usa el usuario admin que creaste en Supabase Auth (el email que pusiste en las políticas RLS: <strong>jsnowoliv@gmail.com</strong>).</p>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Stock en vivo</h1>
      <div className="row">
        <input placeholder="Producto" value={name} onChange={(e)=>setName(e.target.value)} />
        <input type="number" value={qty} onChange={(e)=>setQty(e.target.value)} />
        <button onClick={addProduct}>Agregar</button>
        <button onClick={signOut}>Salir</button>
      </div>

      <ul>
        {products.map((p) => (
          <li key={p.id} className="product">
            <span>{p.name} ({p.quantity})</span>
            <div className="buttons">
              <button onClick={() => updateQuantity(p.id, +1)}>+1</button>
              <button onClick={() => updateQuantity(p.id, -1)}>-1</button>
              <button onClick={() => deleteProduct(p.id)}>Eliminar</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
