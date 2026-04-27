import type { SupabaseClient } from '@supabase/supabase-js'

export class CronLogger {
  private logId: string | null = null
  private job: string
  private sb: SupabaseClient

  constructor(job: string, sb: SupabaseClient) {
    this.job = job
    this.sb = sb
  }

  async start() {
    const { data } = await this.sb
      .from('cron_logs')
      .insert({ job: this.job, status: 'running' })
      .select('id')
      .single()
    this.logId = data?.id ?? null
  }

  async finish(status: 'success' | 'error', summary: Record<string, unknown>) {
    if (!this.logId) return
    await this.sb
      .from('cron_logs')
      .update({ status, finished_at: new Date().toISOString(), summary })
      .eq('id', this.logId)
  }
}
