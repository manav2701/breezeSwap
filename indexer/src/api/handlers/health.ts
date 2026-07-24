import { Request, Response } from 'express'
import { supabase } from '../../db/client'

export async function healthHandler(req: Request, res: Response) {
  try {
    const { data } = await supabase.from('indexer_state').select('*').eq('id', 'coston2_main').single()
    res.json({
      status: 'ok',
      lastIndexedBlock: data?.last_block ?? 0,
      updatedAt: data?.updated_at ?? null
    })
  } catch (err: any) {
    res.json({
      status: 'ok',
      lastIndexedBlock: 0,
      updatedAt: null,
      note: 'Database connecting'
    })
  }
}
