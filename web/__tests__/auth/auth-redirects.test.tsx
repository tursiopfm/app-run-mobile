import { redirect } from 'next/navigation'
import LoginRedirect from '@/app/login/page'
import ResetRedirect from '@/app/auth/reset/page'

jest.mock('next/navigation', () => ({ redirect: jest.fn() }))

describe('redirections auth héritées', () => {
  beforeEach(() => jest.clearAllMocks())

  it('/login redirige vers /', () => {
    LoginRedirect()
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('/auth/reset redirige vers /', () => {
    ResetRedirect()
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
