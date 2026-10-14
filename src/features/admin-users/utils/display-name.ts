export function displayName(user: { firstName: string | null; lastName: string | null; name: string }) {
  return user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name;
}
