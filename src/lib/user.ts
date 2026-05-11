export type User = {
  name: string
  email: string
  initials: string
}

const placeholderUser: User = {
  name: 'Anonymous',
  email: 'you@example.com',
  initials: 'AN',
}

export function useUser(): User {
  return placeholderUser
}
