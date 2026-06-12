// Mock du SDK OpenAI : on contrôle la réponse de chat.completions.create.
const mockCreate = jest.fn()
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = { completions: { create: mockCreate } }
  },
}))

import { searchOfficialWebsite } from '@/lib/race-import/search-website'

const target = { name: 'UTMB', date: '2026-08-28' }

beforeEach(() => {
  mockCreate.mockReset()
  process.env.OPENAI_API_KEY = 'test-key'
})

test('retourne l\'URL de la 1re citation url_citation', async () => {
  mockCreate.mockResolvedValue({
    choices: [{ message: {
      content: 'Le site officiel est utmbmontblanc.com',
      annotations: [
        { type: 'url_citation', url_citation: { url: 'https://utmbmontblanc.com/' } },
      ],
    } }],
  })
  await expect(searchOfficialWebsite(target)).resolves.toBe('https://utmbmontblanc.com/')
})

test('filet : 1re URL du contenu si aucune annotation', async () => {
  mockCreate.mockResolvedValue({
    choices: [{ message: {
      content: 'Voir https://marathondumontblanc.com pour les infos.',
      annotations: [],
    } }],
  })
  await expect(searchOfficialWebsite(target)).resolves.toBe('https://marathondumontblanc.com')
})

test('retourne null si aucune URL', async () => {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: 'Je ne trouve pas.', annotations: [] } }],
  })
  await expect(searchOfficialWebsite(target)).resolves.toBeNull()
})

test('lève si OPENAI_API_KEY absente', async () => {
  delete process.env.OPENAI_API_KEY
  await expect(searchOfficialWebsite(target)).rejects.toThrow('OPENAI_API_KEY')
})
