// Spanish text of every email the API sends. This is the one place outside
// apps/web/src/i18n where user-facing Spanish lives (CLAUDE.md §2): emails
// are rendered by the API, which does not depend on the web app.

export const mailMessages = {
  appName: 'Mi consulta',
  greeting: (name: string) => `Hola, ${name}:`,
  ignoreIfNotYou:
    'Si no fuiste tú, puedes ignorar este correo; tu cuenta no cambiará.',
  linkFallback:
    'Si el botón no funciona, copia y pega este enlace en tu navegador:',
  emailVerification: {
    subject: 'Confirma tu correo electrónico',
    intro:
      'Gracias por registrarte en Mi consulta. Para empezar a usar tu cuenta, confirma tu correo electrónico.',
    action: 'Confirmar mi correo',
    expiry: 'El enlace vence en 24 horas.',
  },
  passwordReset: {
    subject: 'Restablece tu contraseña',
    intro:
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Mi consulta.',
    action: 'Elegir una contraseña nueva',
    expiry: 'El enlace vence en 1 hora y solo se puede usar una vez.',
  },
  passwordChanged: {
    subject: 'Tu contraseña cambió',
    intro:
      'La contraseña de tu cuenta de Mi consulta se cambió y se cerraron todas tus sesiones.',
    notYou:
      'Si no fuiste tú, restablece tu contraseña de inmediato desde la página de inicio de sesión.',
  },
} as const;
