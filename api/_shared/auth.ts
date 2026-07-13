interface AuthBody {
  username?: string
  password?: string
  secret?: string
}

export function isAuthorized(body: AuthBody): boolean {
  const assistantSecret =
    process.env.ASSISTANT_SECRET?.trim() || process.env.VITE_ASSISTANT_SECRET?.trim()
  if (body.secret && assistantSecret && body.secret === assistantSecret) return true
  if (!body.username || !body.password) return false

  const pairs = [
    [process.env.VITE_ACCOUNT_1_USERNAME, process.env.VITE_ACCOUNT_1_PASSWORD],
    [process.env.ACCOUNT_1_USERNAME, process.env.ACCOUNT_1_PASSWORD],
    [process.env.VITE_ACCOUNT_2_USERNAME, process.env.VITE_ACCOUNT_2_PASSWORD],
    [process.env.ACCOUNT_2_USERNAME, process.env.ACCOUNT_2_PASSWORD],
  ]

  const cleanUser = body.username.trim().toLowerCase()
  const cleanPass = body.password.trim()

  return pairs.some(([user, pass]) => {
    if (!user || !pass) return false
    return user.trim().toLowerCase() === cleanUser && pass.trim() === cleanPass
  })
}
