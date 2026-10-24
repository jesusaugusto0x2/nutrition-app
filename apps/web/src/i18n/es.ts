/**
 * Spanish UI texts. Every user-facing string lives here, keyed in English.
 * Components read them through `t` (see ./index.ts); never hardcode visible
 * text in components.
 */
export const es = {
  app: {
    name: 'Nutri',
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
    patients: 'Pacientes',
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
  },
  consultations: {
    listTitle: 'Consultas',
    empty: 'Este paciente aún no tiene consultas registradas.',
    weight: 'Peso',
    height: 'Estatura',
    bmi: 'IMC',
    arm: 'Brazo',
    waist: 'Cintura',
    leg: 'Pierna',
    hip: 'Cadera',
    notes: 'Notas',
    sincePrevious: (days: number) =>
      days === 1 ? 'vs. hace 1 día' : `vs. hace ${days} días`,
  },
  auth: {
    title: 'Iniciar sesión',
    comingSoon: 'El inicio de sesión estará disponible próximamente.',
  },
  portal: {
    title: 'Portal del paciente',
    comingSoon: 'El portal para pacientes estará disponible próximamente.',
  },
};

/** Shape every additional language must implement. */
export type Messages = typeof es;
