/**
 * Spanish UI texts. Every user-facing string lives here, keyed in English.
 * Components read them through `t` (see ./index.ts); never hardcode visible
 * text in components.
 */
export const es = {
  app: {
    name: 'Mi consulta',
    tagline: 'Registro de pacientes',
  },
  common: {
    loading: 'Cargando…',
    back: 'Volver',
    retry: 'Reintentar',
    notAvailable: '—',
    errorTitle: 'Algo salió mal',
    errorDescription: 'No pudimos cargar la información. Intenta de nuevo.',
    notFoundTitle: 'Página no encontrada',
    notFoundDescription: 'La página que buscas no existe.',
    goHome: 'Ir al inicio',
    yes: 'Sí',
    no: 'No',
    remove: 'Quitar',
  },
  forms: {
    unanswered: 'Sin responder',
    computedHint: 'se calcula sola',
    showPassword: 'Mostrar',
    hidePassword: 'Ocultar',
    datePlaceholder: 'dd/mm/aaaa',
  },
  nav: {
    label: 'Principal',
    home: 'Inicio',
    patients: 'Pacientes',
    comingSoon: 'Próximamente',
  },
  account: {
    menu: 'Cuenta',
    signOut: 'Cerrar sesión',
    // Neutral wording: the staff app says «usted» and the portal «tú».
    signOutFailed: 'No se pudo cerrar la sesión: sigue abierta.',
  },
  comingSoon: {
    title: 'Próximamente',
    intro:
      'Funciones que se sumarán más adelante. Por ahora no están disponibles.',
    badge: 'Próximamente',
    features: {
      agenda: {
        menu: 'Agenda de citas',
        title: 'Agenda de citas',
        description: 'Programar consultas y ver el día de un vistazo.',
      },
      mealPlan: {
        menu: 'Plan alimenticio',
        title: 'Plan alimenticio',
        description: 'Armar y guardar el plan de cada paciente.',
      },
      pdfReport: {
        menu: 'Reporte PDF',
        title: 'Reporte PDF para el paciente',
        description:
          'Un resumen de su evolución, listo para imprimir o enviar.',
      },
      whatsapp: {
        menu: 'Recordatorios WhatsApp',
        title: 'Recordatorios por WhatsApp',
        description: 'Avisos de la próxima cita al teléfono del paciente.',
      },
    },
  },
  profileTabs: {
    label: 'Secciones de la ficha',
    summary: 'Resumen',
    history: 'Historia nutricional',
    measurements: 'Control de medidas',
    notes: 'Notas',
  },
  pagination: {
    label: (items: string) => `Páginas de ${items}`,
    newer: 'Más recientes',
    older: 'Más antiguas',
    page: (page: number) => `Página ${page}`,
    showing: (from: number, to: number, total: number, items: string) =>
      `Mostrando ${from}–${to} de ${total} ${items}`,
  },
  notices: {
    undo: 'Deshacer',
  },
  units: {
    kilograms: 'kg',
    meters: 'm',
    centimeters: 'cm',
    bmi: 'kg/m²',
  },
  patients: {
    listTitle: 'Pacientes',
    empty: 'Aún no hay pacientes registrados.',
    age: (years: number) => (years === 1 ? '1 año' : `${years} años`),
    sex: {
      female: 'Femenino',
      male: 'Masculino',
    },
    birthDate: 'Fecha de nacimiento',
    phone: 'Teléfono',
    address: 'Dirección',
    notFound: 'Paciente no encontrado',
    backToList: 'Volver a pacientes',
    lastConsultation: (date: string) => `Última consulta ${date}`,
    noConsultations: 'Sin consultas todavía',
    viewProfile: 'Ver ficha',
    viewProfileOf: (name: string) => `Ver ficha de ${name}`,
    currentBmi: 'IMC actual',
    columns: {
      patient: 'Paciente',
      age: 'Edad',
      lastConsultation: 'Última consulta',
      currentWeight: 'Peso actual',
      trend: 'Tendencia',
    },
  },
  consultations: {
    listTitle: 'Consultas',
    empty: 'Este paciente aún no tiene consultas registradas.',
    newConsultation: 'Nueva consulta',
    date: 'Fecha',
    weight: 'Peso',
    height: 'Talla',
    bmi: 'IMC',
    arm: 'Brazo',
    waist: 'Cintura',
    leg: 'Pierna',
    hip: 'Cadera',
    notes: 'Notas',
    sincePrevious: (days: number) =>
      days === 1 ? 'vs. hace 1 día' : `vs. hace ${days} días`,
    withUnit: (label: string, unit: string) => `${label} (${unit})`,
    inUnit: (label: string, unit: string) => `${label} en ${unit}`,
    previous: (value: string) => `Anterior: ${value}`,
    difference: 'Diferencia',
    noChange: 'Sin cambio',
    noChangeInline: 'sin cambio',
    initial: 'inicial',
    latest: 'Última consulta',
    first: 'Primera consulta',
    totalChange: 'Cambio total',
    totalRange: (from: string, to: string) => `del ${from} al ${to}`,
    edit: 'Editar',
    editOf: (date: string) => `Editar consulta del ${date}`,
    save: 'Guardar',
    cancel: 'Cancelar',
    records: 'Registros',
    /** Plural noun for pagination: «Mostrando 1–3 de 4 consultas». */
    items: 'consultas',
    saved: 'Consulta guardada',
    viewMeasurements: 'Ver control de medidas',
    weightRequired: 'Escriba al menos el peso para poder guardar.',
    saveConsultation: 'Guardar consulta',
  },
  trend: {
    down: (amount: string) => `Bajó ${amount}`,
    up: (amount: string) => `Subió ${amount}`,
    none: 'Sin cambio',
  },
  /** Same as `trend`, inside a sentence: «58,4 kg · bajó 1,6 kg». */
  trendInline: {
    down: (amount: string) => `bajó ${amount}`,
    up: (amount: string) => `subió ${amount}`,
    none: 'sin cambio',
  },
  chart: {
    range: (from: string, to: string) => `De ${from} a ${to}`,
    singlePoint: 'Falta una consulta más para ver la evolución.',
  },
  bmi: {
    label: 'IMC',
    prompt: 'Escriba peso y talla para ver el IMC',
    withHeight: (height: string) => `con talla ${height}`,
    categories: {
      underweight: 'Bajo peso',
      normal: 'Peso normal',
      overweight: 'Sobrepeso',
      obesity1: 'Obesidad grado I',
      obesity2: 'Obesidad grado II',
      obesity3: 'Obesidad grado III',
    },
    minor: 'Menor de edad',
    percentileNote:
      'En menores de edad el IMC se interpreta por percentil según edad y sexo.',
  },
  auth: {
    title: 'Iniciar sesión',
    subtitle: 'Entra con tu cuenta de Google o con tu email.',
    panelTitle: 'El seguimiento nutricional, siempre a mano.',
    panelSubtitle:
      'Para nutricionistas y sus pacientes, en el teléfono y en la computadora.',
    email: 'Email',
    emailPlaceholder: 'nombre@correo.com',
    emailRequired: 'Escribe tu email.',
    emailInvalid: 'Revisa el email: debe verse como nombre@correo.com',
    password: 'Contraseña',
    passwordRequired: 'Escribe tu contraseña.',
    forgotPassword: '¿Olvidaste tu contraseña?',
    submit: 'Entrar',
    submitLocked: (time: string) => `Entrar · disponible en ${time}`,
    noAccount: '¿Eres nutricionista y no tienes cuenta?',
    createAccount: 'Crear cuenta',
    patientHint:
      '¿Eres paciente? Entra con el enlace de invitación que te envió tu nutricionista.',
    invalidCredentialsTitle: 'El email o la contraseña no coinciden.',
    invalidCredentialsBody: 'Revisa e inténtalo de nuevo.',
    tooManyAttemptsTitle: 'Demasiados intentos.',
    tooManyAttemptsBody: (minutes: number) =>
      `Por seguridad pausamos el acceso con contraseña. Podrás intentar de nuevo en ${
        minutes === 1 ? '1 minuto' : `${minutes} minutos`
      }.`,
    tooManyAttemptsLater:
      'Por seguridad pausamos el acceso con contraseña. Inténtalo de nuevo en unos minutos.',
    createNewPassword: 'Crear una contraseña nueva ahora',
    emailNotVerifiedTitle: 'Falta verificar tu email.',
    emailNotVerifiedBody:
      'Abre el enlace que te enviamos para activar tu cuenta.',
    resendEmail: 'Reenviar enlace',
    emailResent: 'Te enviamos un enlace nuevo. El anterior ya no funciona.',
    resendFailed:
      'No pudimos reenviar el enlace. Inténtalo de nuevo en unos minutos.',
    signInFailedBody: 'No pudimos iniciar sesión. Inténtalo de nuevo.',
  },
  signUp: {
    title: 'Crear cuenta',
    subtitle:
      'Para nutricionistas. Tus pacientes no se registran: entran con la invitación que les envíes.',
    name: 'Nombre y apellido',
    namePlaceholder: 'Ej.: Carmen Rojas',
    nameRequired: 'Escribe tu nombre.',
    passwordMinLength: (characters: number) =>
      `Al menos ${characters} caracteres.`,
    passwordTip: 'Puedes usar espacios: una frase es fácil de recordar.',
    passwordTooShort: (characters: number) =>
      `Usa al menos ${characters} caracteres.`,
    clinicName: 'Nombre del consultorio',
    clinicNamePlaceholder: 'Ej.: Nutrición Rojas',
    clinicNameHelp:
      'Tus pacientes lo verán en sus invitaciones. Puedes cambiarlo después.',
    clinicNameRequired: 'Escribe el nombre de tu consultorio.',
    tooLong: (characters: number) =>
      `Usa como máximo ${characters} caracteres.`,
    submit: 'Crear cuenta',
    haveAccount: '¿Ya tienes cuenta?',
    signIn: 'Inicia sesión',
    tooManyAttemptsBody: (minutes: number) =>
      `Podrás intentarlo de nuevo en ${
        minutes === 1 ? '1 minuto' : `${minutes} minutos`
      }.`,
    tooManyAttemptsLater: 'Inténtalo de nuevo en unos minutos.',
    failedBody: 'No pudimos crear tu cuenta. Inténtalo de nuevo.',
  },
  checkEmail: {
    title: 'Verifica tu email',
    sentTo: 'Te enviamos un enlace a',
    openIt: 'Ábrelo para activar tu cuenta.',
    expires: 'El enlace vence en 24 horas.',
    spam: '¿No lo ves? Revisa las carpetas de spam y de promociones.',
    resend: 'Reenviar enlace',
    resendIn: (time: string) => `Podrás reenviarlo en ${time}`,
    resent: 'Te enviamos un enlace nuevo. El anterior ya no funciona.',
    resendThrottled: (minutes: number) =>
      `Ya enviamos varios enlaces. Podrás pedir otro en ${
        minutes === 1 ? '1 minuto' : `${minutes} minutos`
      }.`,
    resendThrottledLater:
      'Ya enviamos varios enlaces. Podrás pedir otro en unos minutos.',
    wrongEmail: '¿Escribiste mal tu email? Corrígelo',
    backToSignIn: 'Volver a iniciar sesión',
  },
  google: {
    continue: 'Continuar con Google',
    orWithEmail: 'o con tu email',
    signUpHint: 'Después te pediremos el nombre de tu consultorio.',
    failedTitle: 'No pudimos iniciar sesión con Google.',
    failedBody: 'Inténtalo de nuevo o entra con tu email y tu contraseña.',
  },
  onboarding: {
    title: 'Crea tu consultorio',
    subtitle:
      'Un último paso: dinos cómo se llama tu consultorio para empezar a registrar pacientes.',
    submit: 'Crear consultorio',
    failedBody: 'No pudimos crear tu consultorio. Inténtalo de nuevo.',
    otherAccount: '¿No es tu cuenta?',
    signOut: 'Cerrar sesión',
    signOutFailed: 'No pudimos cerrar la sesión. Inténtalo de nuevo.',
  },
  portal: {
    title: 'Portal del paciente',
    comingSoon: 'El portal para pacientes estará disponible próximamente.',
  },
};

/** Shape every additional language must implement. */
export type Messages = typeof es;
