export default defineEventHandler(async (event) => {
  // Supprimer le cookie de session
  deleteCookie(event, 'session', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/'
  })

  // Retourner un message de succès
  return {
    success: true,
    message: 'Logged out successfully'
  }
})