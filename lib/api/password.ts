import { post } from './client'

export async function forgotPassword(email: string): Promise<void> {
  await post('/auth/forgot-password', { email })
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await post('/auth/reset-password', { token, newPassword })
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await post('/auth/change-password', { currentPassword, newPassword })
}

export async function adminResetPassword(userId: string): Promise<void> {
  await post(`/users/${userId}/reset-password`)
}
