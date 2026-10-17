import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const auth = {
    content: {
        "auth.adopt.body": t({
            en: "Choose what to keep. Only the first option keeps everything — the other two delete entries permanently.",
            es: "Elige qué quieres conservar. Solo la primera opción conserva todo; las otras dos borran entradas para siempre.",
        }),
        "auth.adopt.confirm.cancel": t({
            en: "Keep both instead",
            es: "Mejor conservar los dos",
        }),
        "auth.adopt.confirm.keepAccount": t({
            en: "This phone's entries will be deleted and cannot be recovered. Your account's ledger is what remains.",
            es: "Las entradas de este celular se borrarán y no se podrán recuperar. Solo queda el registro de tu cuenta.",
        }),
        "auth.adopt.confirm.keepLocal": t({
            en: "Your account's entries will be deleted and cannot be recovered. This phone's ledger is what remains.",
            es: "Las entradas de tu cuenta se borrarán y no se podrán recuperar. Solo queda el registro de este celular.",
        }),
        "auth.adopt.confirm.proceed": t({
            en: "Delete and continue",
            es: "Borrar y continuar",
        }),
        "auth.adopt.confirm.title": t({
            en: "This deletes entries",
            es: "Esto borra entradas",
        }),
        "auth.adopt.eyebrow": t({
            en: "Two ledgers",
            es: "Dos registros",
        }),
        "auth.adopt.failed": t({
            en: "That could not be applied. Nothing was changed on either side — try again.",
            es: "No se pudo aplicar. No cambió nada en ningún lado. Inténtalo de nuevo.",
        }),
        "auth.adopt.keepAccount.body": t({
            en: "Deletes every entry on this phone and replaces it with your account's ledger.",
            es: "Borra cada entrada de este celular y la reemplaza con el registro de tu cuenta.",
        }),
        "auth.adopt.keepAccount.title": t({
            en: "Keep only the account's",
            es: "Conservar solo el de la cuenta",
        }),
        "auth.adopt.keepLocal.body": t({
            en: "Deletes every entry your account holds and replaces it with this phone's ledger.",
            es: "Borra cada entrada que tiene tu cuenta y la reemplaza con el registro de este celular.",
        }),
        "auth.adopt.keepLocal.title": t({
            en: "Keep only this phone's",
            es: "Conservar solo el de este celular",
        }),
        "auth.adopt.merge.body": t({
            en: "Every entry from this phone and from your account survives. Nothing is deleted. Duplicate categories are yours to tidy up afterwards.",
            es: "Se quedan todas las entradas de este celular y de tu cuenta. No se borra nada. Si quedan categorías duplicadas, puedes ordenarlas después.",
        }),
        "auth.adopt.merge.title": t({
            en: "Keep both",
            es: "Conservar los dos",
        }),
        "auth.adopt.title": t({
            en: "This phone and your account both hold entries",
            es: "Este celular y tu cuenta tienen entradas",
        }),
        "auth.adopt.working": t({
            en: "Reconciling…",
            es: "Conciliando…",
        }),
        "auth.email.code": t({
            en: "Code",
            es: "Código",
        }),
        "auth.email.continue": t({
            en: "Continue with email",
            es: "Continuar con correo",
        }),
        "auth.email.create": t({
            en: "New here? Create an account",
            es: "¿Eres nuevo? Crea una cuenta",
        }),
        "auth.email.create.action": t({
            en: "Create account",
            es: "Crear cuenta",
        }),
        "auth.email.create.title": t({
            en: "Create an account",
            es: "Crea una cuenta",
        }),
        "auth.email.email": t({
            en: "Email",
            es: "Correo",
        }),
        "auth.email.error.attempts": t({
            en: "Too many tries with that code. Send a new one.",
            es: "Demasiados intentos con ese código. Pide uno nuevo.",
        }),
        "auth.email.error.code": t({
            en: "That code is wrong or expired.",
            es: "Ese código no es válido o ya caducó.",
        }),
        "auth.email.error.credentials": t({
            en: "That email and password don't match.",
            es: "El correo y la contraseña no coinciden.",
        }),
        "auth.email.error.email": t({
            en: "Enter a valid email.",
            es: "Escribe un correo válido.",
        }),
        "auth.email.error.rateLimited": t({
            en: "Too many tries. Wait a bit and try again.",
            es: "Demasiados intentos. Espera un poco y vuelve a intentarlo.",
        }),
        "auth.email.forgot": t({
            en: "Forgot password?",
            es: "¿Olvidaste tu contraseña?",
        }),
        "auth.email.forgot.action": t({
            en: "Send code",
            es: "Enviar código",
        }),
        "auth.email.forgot.body": t({
            en: "We'll email you a code to set a new one.",
            es: "Te enviaremos un código para crear una nueva.",
        }),
        "auth.email.forgot.title": t({
            en: "Reset your password",
            es: "Restablece tu contraseña",
        }),
        "auth.email.hidePassword": t({
            en: "Hide password",
            es: "Ocultar contraseña",
        }),
        "auth.email.newPassword": t({
            en: "New password",
            es: "Contraseña nueva",
        }),
        "auth.email.password": t({
            en: "Password",
            es: "Contraseña",
        }),
        "auth.email.passwordHint": t({
            en: "8 or more characters",
            es: "8 caracteres o más",
        }),
        "auth.email.resend": t({
            en: "Send a new code",
            es: "Enviar un código nuevo",
        }),
        "auth.email.resent": t({
            en: "New code sent.",
            es: "Código nuevo enviado.",
        }),
        "auth.email.reset.action": t({
            en: "Set password",
            es: "Guardar contraseña",
        }),
        "auth.email.reset.body": t({
            en: "Enter the code we sent to {email} and choose a new password.",
            es: "Escribe el código que enviamos a {email} y elige una contraseña nueva.",
        }),
        "auth.email.showPassword": t({
            en: "Show password",
            es: "Mostrar contraseña",
        }),
        "auth.email.signIn.action": t({
            en: "Sign in",
            es: "Iniciar sesión",
        }),
        "auth.email.signIn.title": t({
            en: "Sign in with email",
            es: "Inicia sesión con tu correo",
        }),
        "auth.email.verify.action": t({
            en: "Verify",
            es: "Verificar",
        }),
        "auth.email.verify.body": t({
            en: "Enter the code we sent to {email}.",
            es: "Escribe el código que enviamos a {email}.",
        }),
        "auth.email.verify.title": t({
            en: "Check your email",
            es: "Revisa tu correo",
        }),
        "auth.google.continue": t({
            en: "Continue with Google",
            es: "Continuar con Google",
        }),
        "auth.restoring.title": t({
            en: "Opening your ledger",
            es: "Abriendo tu registro",
        }),
        "auth.signIn.agreement": t({
            en: "By using Outlayr, you agree to the {terms} and {privacy}.",
            es: "Al usar Outlayr, aceptas los {terms} y la {privacy}.",
        }),
        "auth.signIn.begun": t({
            en: "Begun {date}.",
            es: "Comenzado el {date}.",
        }),
        "auth.signIn.body": t({
            en: "Your ledger is on this phone and it stays there. An account means it survives losing the phone.",
            es: "Tu registro vive en este celular y ahí se queda. Con una cuenta, sobrevive aunque pierdas el celular.",
        }),
        "auth.signIn.eyebrow": t({
            en: "Account",
            es: "Cuenta",
        }),
        "auth.signIn.kept": t({
            en: "Kept in {currency}.",
            es: "Se lleva en {currency}.",
        }),
        "auth.signIn.notNow": t({
            en: "Not now — open my ledger",
            es: "Ahora no, abrir mi registro",
        }),
        "auth.signIn.offline": t({
            en: "Signing in needs a connection. Once you have, your ledger opens offline.",
            es: "Para iniciar sesión necesitas conexión. Después, tu registro abre sin conexión.",
        }),
        "auth.signIn.pending": t({
            en: "Signing in…",
            es: "Iniciando sesión…",
        }),
        "auth.signIn.title": t({
            en: "Keep a copy of this?",
            es: "¿Quieres guardar una copia?",
        }),
        "auth.signIn.written": t({
            en: "Written daily at {time}.",
            es: "Se escribe a diario a las {time}.",
        }),
    },
    key: "auth" as const,
} satisfies Dictionary;

export default auth;
