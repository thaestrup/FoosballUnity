import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { api, ApiError } from './api'

const BASE = 'http://localhost:5050'

describe('api()', () => {
  describe('JSON responses', () => {
    it('returns parsed JSON for a 200 response', async () => {
      server.use(
        http.get(`${BASE}/players/`, () =>
          HttpResponse.json([{ name: 'Lars', playerReady: true }]),
        ),
      )
      const result = await api<Array<{ name: string; playerReady: boolean }>>(
        '/players/',
      )
      expect(result).toEqual([{ name: 'Lars', playerReady: true }])
    })

    it('parses JSON objects too', async () => {
      server.use(
        http.get(`${BASE}/something`, () => HttpResponse.json({ a: 1, b: 'two' })),
      )
      const result = await api<{ a: number; b: string }>('/something')
      expect(result).toEqual({ a: 1, b: 'two' })
    })
  })

  describe('plain-text responses (write ops)', () => {
    it('returns the raw text body when not JSON', async () => {
      server.use(
        http.post(`${BASE}/players/`, () =>
          HttpResponse.text('insertPlayer: Foo, result: 88'),
        ),
      )
      const result = await api<string>('/players/', { method: 'POST' })
      expect(result).toBe('insertPlayer: Foo, result: 88')
    })
  })

  describe('error responses', () => {
    it('throws ApiError with status 404', async () => {
      server.use(
        http.get(`${BASE}/missing`, () =>
          new HttpResponse(null, { status: 404 }),
        ),
      )
      await expect(api('/missing')).rejects.toBeInstanceOf(ApiError)
      try {
        await api('/missing')
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError)
        expect((e as ApiError).status).toBe(404)
        expect((e as ApiError).message).toContain('404')
        expect((e as ApiError).message).toContain('/missing')
      }
    })

    it('throws ApiError with status 500', async () => {
      server.use(
        http.get(`${BASE}/boom`, () => new HttpResponse('kaboom', { status: 500 })),
      )
      await expect(api('/boom')).rejects.toMatchObject({
        name: 'ApiError',
        status: 500,
      })
    })

    it('includes the method in the error message', async () => {
      server.use(
        http.delete(`${BASE}/x`, () => new HttpResponse(null, { status: 500 })),
      )
      try {
        await api('/x', { method: 'DELETE' })
      } catch (e) {
        expect((e as ApiError).message).toContain('DELETE')
      }
    })
  })

  describe('empty body', () => {
    it('returns null when the body is empty', async () => {
      server.use(http.get(`${BASE}/empty`, () => new HttpResponse(null)))
      const result = await api('/empty')
      expect(result).toBeNull()
    })
  })

  describe('init propagation', () => {
    it('forwards method and custom headers to fetch', async () => {
      let observedMethod: string | undefined
      let observedHeader: string | null | undefined
      server.use(
        http.put(`${BASE}/echo`, ({ request }) => {
          observedMethod = request.method
          observedHeader = request.headers.get('x-custom')
          return HttpResponse.json({ ok: true })
        }),
      )

      await api('/echo', {
        method: 'PUT',
        headers: { 'x-custom': 'value-here' },
      })

      expect(observedMethod).toBe('PUT')
      expect(observedHeader).toBe('value-here')
    })

    it('applies the default Content-Type when no headers are passed', async () => {
      let observedContentType: string | null | undefined
      server.use(
        http.get(`${BASE}/default-ct`, ({ request }) => {
          observedContentType = request.headers.get('content-type')
          return HttpResponse.json({ ok: true })
        }),
      )
      await api('/default-ct')
      expect(observedContentType).toBe('application/json')
    })

    it('allows overriding the default Content-Type via init.headers', async () => {
      let observedContentType: string | null | undefined
      server.use(
        http.post(`${BASE}/ct`, ({ request }) => {
          observedContentType = request.headers.get('content-type')
          return HttpResponse.text('ok')
        }),
      )
      await api('/ct', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
      })
      expect(observedContentType).toBe('text/plain')
    })

    it('keeps the default Content-Type when init.headers does not override it', async () => {
      let observedContentType: string | null | undefined
      server.use(
        http.put(`${BASE}/merged`, ({ request }) => {
          observedContentType = request.headers.get('content-type')
          return HttpResponse.json({ ok: true })
        }),
      )
      await api('/merged', {
        method: 'PUT',
        headers: { 'x-custom': 'value-here' },
      })
      expect(observedContentType).toBe('application/json')
    })
  })
})
