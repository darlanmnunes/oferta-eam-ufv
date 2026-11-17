import { demo } from './demo'
import { criarApiSupabase } from './supabase'
import type { Api } from './tipos'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const api: Api = url && chave ? criarApiSupabase(url, chave) : demo
