export interface LocalAccount {
  username: string
  password: string
  displayName: string
  storageId: string
}

export interface ActiveAccount {
  username: string
  displayName: string
  storageId: string
}

const ACTIVE_ACCOUNT_KEY = 'life-quest-active-account'

const rawAccounts: LocalAccount[] = [
  {
    username: import.meta.env.VITE_ACCOUNT_1_USERNAME ?? '',
    password: import.meta.env.VITE_ACCOUNT_1_PASSWORD ?? '',
    displayName: import.meta.env.VITE_ACCOUNT_1_NAME ?? '',
    storageId: 'account-1',
  },
  {
    username: import.meta.env.VITE_ACCOUNT_2_USERNAME ?? '',
    password: import.meta.env.VITE_ACCOUNT_2_PASSWORD ?? '',
    displayName: import.meta.env.VITE_ACCOUNT_2_NAME ?? '',
    storageId: 'account-2',
  },
]

export const configuredAccounts = rawAccounts
  .map((account) => ({
    ...account,
    username: account.username.trim(),
    password: account.password.trim(),
    displayName: account.displayName.trim() || account.username.trim(),
  }))
  .filter((account) => account.username && account.password)

function toActiveAccount(account: LocalAccount): ActiveAccount {
  return {
    username: account.username,
    displayName: account.displayName,
    storageId: account.storageId,
  }
}

export function signIn(username: string, password: string): ActiveAccount | null {
  const cleanUsername = username.trim().toLowerCase()
  const cleanPassword = password.trim()
  const account = configuredAccounts.find(
    (item) => item.username.toLowerCase() === cleanUsername && item.password === cleanPassword,
  )

  if (!account) return null
  const activeAccount = toActiveAccount(account)
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeAccount.storageId)
  return activeAccount
}

export function getRememberedAccount(): ActiveAccount | null {
  const storageId = localStorage.getItem(ACTIVE_ACCOUNT_KEY)
  if (!storageId) return null
  const account = configuredAccounts.find((item) => item.storageId === storageId)
  return account ? toActiveAccount(account) : null
}

export function signOut(): void {
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
}
