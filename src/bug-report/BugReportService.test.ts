import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createBugReportService } from './BugReportService'

function createService() {
  const update = vi.fn()
  const eq = vi.fn()
  const is = vi.fn()
  const builder = {
    update: (values: unknown) => {
      update(values)
      return builder
    },
    eq: (column: string, value: unknown) => {
      eq(column, value)
      return builder
    },
    is: (column: string, value: unknown) => {
      is(column, value)
      return builder
    },
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  }
  const client = {
    from: vi.fn(() => builder),
  } as unknown as SupabaseClient
  return {
    service: createBugReportService(
      {
        supabaseUrl: 'https://example.supabase.co',
        supabasePublishableKey: 'test-key',
      },
      () => client,
    ),
    update,
    eq,
    is,
  }
}

describe('BugReportService', () => {
  it('soft deletes a report by setting deleted_at once', async () => {
    const { service, update, eq, is } = createService()

    await service.softDelete(42)

    expect(update).toHaveBeenCalledWith({ deleted_at: expect.any(String) })
    expect(eq).toHaveBeenCalledWith('id', 42)
    expect(is).toHaveBeenCalledWith('deleted_at', null)
  })
})
