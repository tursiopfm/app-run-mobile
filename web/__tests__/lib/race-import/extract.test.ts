import { extractWaypoints } from '@/lib/race-import/extract'

jest.mock('openai', () => {
  const create = jest.fn()
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: { completions: { create } },
    })),
    _create: create,
  }
})

// Récup du mock pour le contrôler dans les tests.
const openaiMod = require('openai')
const mockCreate = openaiMod._create as jest.Mock

describe('extractWaypoints', () => {
  beforeEach(() => {
    mockCreate.mockReset()
    process.env.OPENAI_API_KEY = 'test-key'
  })

  it('mappe la sortie LLM snake_case en ExtractedRaceData camelCase', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              race_name: 'CCC',
              edition_year: 2024,
              waypoints: [
                {
                  order_index: 0,
                  name: 'Courmayeur',
                  km: 0,
                  km_inter: 0,
                  d_plus: 0,
                  d_moins: 0,
                  cutoff_raw: '09:00',
                  cutoff_kind: 'clock_time',
                  type: 'depart',
                },
                {
                  order_index: 1,
                  name: 'Chamonix',
                  km: 101.7,
                  km_inter: 6.9,
                  d_plus: 6105,
                  d_moins: 6285,
                  cutoff_raw: '12:00',
                  cutoff_kind: 'clock_time',
                  type: 'arrivee',
                },
              ],
            }),
          },
        },
      ],
    })

    const out = await extractWaypoints({ text: 'roadbook CCC ...' })
    expect(out.raceName).toBe('CCC')
    expect(out.waypoints).toHaveLength(2)
    expect(out.waypoints[0].orderIndex).toBe(0)
    expect(out.waypoints[1].name).toBe('Chamonix')
  })

  it('jette une erreur claire si OPENAI_API_KEY absente', async () => {
    delete process.env.OPENAI_API_KEY
    await expect(extractWaypoints({ text: 'x' })).rejects.toThrow(/OPENAI_API_KEY/)
  })

  it('jette une erreur si aucun input fourni', async () => {
    await expect(extractWaypoints({})).rejects.toThrow(/input/i)
  })

  it("appelle gpt-4o avec response_format json_schema strict", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"race_name":null,"edition_year":null,"waypoints":[]}' } }],
    })
    await extractWaypoints({ text: 'x' })
    const args = mockCreate.mock.calls[0][0]
    expect(args.model).toBe('gpt-4o')
    expect(args.response_format.type).toBe('json_schema')
    expect(args.response_format.json_schema.strict).toBe(true)
  })

  it('passe une image en content multimodal', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: '{"race_name":null,"edition_year":null,"waypoints":[]}' } }],
    })
    await extractWaypoints({ imageBase64: 'iVBORw0KG...', imageMime: 'image/png' })
    const args = mockCreate.mock.calls[0][0]
    const userMsg = args.messages.find((m: any) => m.role === 'user')
    expect(userMsg.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'image_url' }),
      ]),
    )
  })
})
