import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const settingsAccount = {
    content: {
        "settings.account.checking": t({
            en: "Checking\u2026",
            es: "Verificando…",
        }),
        "settings.account.delete": t({
            en: "Delete account",
            es: "Eliminar cuenta",
        }),
        "settings.account.deleteConfirm": t({
            en: "Delete",
            es: "Eliminar",
        }),
        "settings.account.deleteConfirmBody": t({
            en: "Your account and everything synced to it are removed for good. The ledger on this device is not touched.",
            es: "Tu cuenta y todo lo sincronizado en ella se eliminan de forma definitiva. El registro de este dispositivo no se toca.",
        }),
        "settings.account.deleteConfirmTitle": t({
            en: "Delete this account?",
            es: "¿Eliminar esta cuenta?",
        }),
        "settings.account.deleteFooter": t({
            en: "Deletes your account and everything synced to it. The ledger on this device stays, and signing in again adopts it.",
            es: "Elimina tu cuenta y todo lo sincronizado en ella. El registro de este dispositivo se conserva y, si vuelves a iniciar sesión, se suma a tu cuenta.",
        }),
        "settings.account.deleteSection": t({
            en: "Deleting your account",
            es: "Eliminar tu cuenta",
        }),
        "settings.account.deleting": t({
            en: "Deleting…",
            es: "Eliminando…",
        }),
        "settings.account.eraseDevice": t({
            en: "Delete account and erase this device",
            es: "Eliminar cuenta y borrar este dispositivo",
        }),
        "settings.account.eraseDeviceConfirm": t({
            en: "Erase device",
            es: "Borrar dispositivo",
        }),
        "settings.account.eraseDeviceConfirmBody": t({
            en: "This permanently removes your account and all erasable Outlayr data on this device.",
            es: "Esto elimina de forma permanente tu cuenta y todos los datos borrables de Outlayr en este dispositivo.",
        }),
        "settings.account.eraseDeviceConfirmTitle": t({
            en: "Erase this device too?",
            es: "¿Borrar también este dispositivo?",
        }),
        "settings.account.eraseDeviceFooter": t({
            en: "Erases Outlayr data on this device after your cloud account is deleted. System permissions and widget placement remain controlled by the OS.",
            es: "Borra los datos de Outlayr de este dispositivo después de eliminar tu cuenta en la nube. Los permisos del sistema y la ubicación de los widgets siguen bajo control del sistema operativo.",
        }),
        "settings.account.eraseDeviceSection": t({
            en: "Erase this device",
            es: "Borrar este dispositivo",
        }),
        "settings.account.eyebrow": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.account.genericFailure": t({
            en: "Sign-in didn't complete. Your ledger on this device is untouched.",
            es: "El inicio de sesi\u00F3n no se complet\u00F3. Tu registro en este dispositivo est\u00E1 intacto.",
        }),
        "settings.account.notSignedIn": t({
            en: "Not signed in",
            es: "No has iniciado sesión",
        }),
        "settings.account.playServices": t({
            en: "Google Play services are unavailable on this device.",
            es: "Los servicios de Google Play no est\u00E1n disponibles en este dispositivo.",
        }),
        "settings.account.resetFailedTitle": t({
            en: "Device cleanup needs attention",
            es: "La limpieza del dispositivo necesita atención",
        }),
        "settings.account.rowTitle": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.account.sectionTitle": t({
            en: "Account",
            es: "Cuenta",
        }),
        "settings.account.signIn": t({
            en: "Sign in",
            es: "Iniciar sesión",
        }),
        "settings.account.signInFooter": t({
            en: "Signing in does not change your ledger. It lets you choose whether to sync this device with your account.",
            es: "Iniciar sesión no cambia tu registro. Te permite elegir si quieres sincronizar este dispositivo con tu cuenta.",
        }),
        "settings.account.signInSection": t({
            en: "Sign in",
            es: "Iniciar sesi\u00F3n",
        }),
        "settings.account.signOut": t({
            en: "Sign Out",
            es: "Cerrar sesi\u00F3n",
        }),
        "settings.account.signOutFooter": t({
            en: "Signing out ends the session on this phone. Every transaction, budget and category stays exactly where it is.",
            es: "Cerrar sesión solo afecta a este celular. Tus transacciones, presupuestos y categorías se quedan tal como están.",
        }),
        "settings.account.signedInAs": t({
            en: "Signed in as",
            es: "Sesi\u00F3n iniciada como",
        }),
        "settings.account.signedInFallback": t({
            en: "Signed in",
            es: "Sesi\u00F3n iniciada",
        }),
        "settings.account.signedOutDetail": t({
            en: "Outlayr keeps your ledger on this device and behaves exactly the same signed out. An account lets you choose to sync it with your other devices.",
            es: "Outlayr guarda tu registro en este dispositivo y funciona igual sin sesión. Con una cuenta, puedes sincronizarlo con tus otros dispositivos si quieres.",
        }),
        "settings.account.signingOut": t({
            en: "Signing out\u2026",
            es: "Cerrando sesi\u00F3n\u2026",
        }),
        "settings.account.unavailable": t({
            en: "Cloud features unavailable",
            es: "Funciones en la nube no disponibles",
        }),
        "settings.account.unavailableDetail": t({
            en: "This build is not configured for cloud features. Your ledger remains available on this device.",
            es: "Esta compilaci\u00F3n no est\u00E1 configurada para funciones en la nube. Tu registro sigue disponible en este dispositivo.",
        }),
        "settings.sync.eyebrow": t({
            en: "This device",
            es: "Este dispositivo",
        }),
        "settings.sync.failedBody": t({
            en: "The switch is where it was and your ledger is untouched. Try again in a moment.",
            es: "El interruptor sigue como estaba y tu registro está intacto. Inténtalo de nuevo en un momento.",
        }),
        "settings.sync.failedTitle": t({
            en: "Sync setting unchanged",
            es: "La sincronización no cambió",
        }),
        "settings.sync.footer": t({
            en: "Turning sync off keeps every transaction, budget and category on this phone; it only stops queueing them for your account. Turning it back on hands over everything logged in between.",
            es: "Si desactivas la sincronización, cada transacción, presupuesto y categoría se queda en este celular; solo deja de enviarse a tu cuenta. Al activarla de nuevo, se envía todo lo que registraste mientras tanto.",
        }),
        "settings.sync.lastSynced": t({
            en: "Last synced",
            es: "Última sincronización",
        }),
        "settings.sync.navTitle": t({
            en: "Sync",
            es: "Sincronización",
        }),
        "settings.sync.needsAccount": t({
            en: "Sync needs an account to replicate to. Until you sign in your ledger stays on this device, which is all Outlayr ever needed to work.",
            es: "Para sincronizar necesitas una cuenta. Hasta que inicies sesión, tu registro se queda en este dispositivo, y eso es todo lo que Outlayr necesita para funcionar.",
        }),
        "settings.sync.never": t({
            en: "Not synced yet",
            es: "Aún sin sincronizar",
        }),
        "settings.sync.neverSynced": t({
            en: "Never",
            es: "Nunca",
        }),
        "settings.sync.off": t({
            en: "Not syncing",
            es: "Sin sincronizar",
        }),
        "settings.sync.offDetail": t({
            en: "Nothing leaves this phone. Your ledger is complete here and works exactly as it does now.",
            es: "Nada sale de este celular. Tu registro está completo aquí y funciona igual que ahora.",
        }),
        "settings.sync.on": t({
            en: "Syncing",
            es: "Sincronizando",
        }),
        "settings.sync.onDetail": t({
            en: "Every change you make here is queued for your account and reaches your other devices.",
            es: "Cada cambio que haces aquí se pone en cola para tu cuenta y llega a tus otros dispositivos.",
        }),
        "settings.sync.paused": t({
            en: "Paused",
            es: "En pausa",
        }),
        "settings.sync.pausedDetail": t({
            en: "Syncing needs Outlayr Pro. Your ledger is complete on this phone and keeps working; changes wait here until Pro is active again.",
            es: "Sincronizar requiere Outlayr Pro. Tu registro está completo en este celular y sigue funcionando; los cambios esperan aquí hasta que Pro esté activo otra vez.",
        }),
        "settings.sync.pending": t({
            en: "{count} waiting to sync",
            es: "{count} por sincronizar",
        }),
        "settings.sync.pendingOne": t({
            en: "1 waiting to sync",
            es: "1 por sincronizar",
        }),
        "settings.sync.section": t({
            en: "Replication",
            es: "Replicación",
        }),
        "settings.sync.statusSection": t({
            en: "Status",
            es: "Estado",
        }),
        "settings.sync.toggle": t({
            en: "Sync this device",
            es: "Sincronizar este dispositivo",
        }),
        "settings.sync.upToDate": t({
            en: "Up to date",
            es: "Al día",
        }),
        "settings.sync.waiting": t({
            en: "Waiting to sync",
            es: "Por sincronizar",
        }),
        "settings.sync.working": t({
            en: "Working…",
            es: "Procesando…",
        }),
        "settings.usage.captures": t({
            en: "of {count} captures",
            es: "de {count} capturas",
        }),
        "settings.usage.capturesKinds": t({
            en: "Voice and receipts",
            es: "Voz y recibos",
        }),
        "settings.usage.fullIn": t({
            en: "Full in {time}",
            es: "Se recarga en {time}",
        }),
        "settings.usage.imports": t({
            en: "CSV imports",
            es: "Importaciones CSV",
        }),
        "settings.usage.left": t({
            en: "{count} left",
            es: "Quedan {count}",
        }),
        "settings.usage.receipts": t({
            en: "Receipt scans",
            es: "Escaneos de recibos",
        }),
        "settings.usage.resets": t({
            en: "Resets {date}",
            es: "Se reinicia el {date}",
        }),
        "settings.usage.suggestions": t({
            en: "Suggestions",
            es: "Sugerencias",
        }),
        "settings.usage.thisHour": t({
            en: "This hour",
            es: "En esta hora",
        }),
        "settings.usage.toast.empty": t({
            en: "No captures left",
            es: "No te quedan capturas",
        }),
        "settings.usage.toast.last": t({
            en: "That was your last capture",
            es: "Esa fue tu última captura",
        }),
        "settings.usage.toast.moreOn": t({
            en: "{count} more on {date}",
            es: "{count} más el {date}",
        }),
        "settings.usage.toast.pro": t({
            en: "Pro",
            es: "Pro",
        }),
        "settings.usage.toast.usage": t({
            en: "Usage",
            es: "Uso",
        }),
        "settings.usage.voice": t({
            en: "Voice",
            es: "Voz",
        }),
    },
    key: "settings-account" as const,
} satisfies Dictionary;

export default settingsAccount;
