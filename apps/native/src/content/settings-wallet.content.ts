import { t } from "intlayer";
import type { Dictionary } from "intlayer";

const settingsWallet = {
    content: {
        "settings.wallet.automationDetail": t({
            en: "Wallet trigger runs Outlayr - Apple Pay",
            es: "El disparador de Wallet ejecuta Outlayr - Apple Pay",
        }),
        "settings.wallet.automationDetailInline": t({
            en: "Wallet trigger runs Log a Wallet Transaction",
            es: "El disparador de Wallet ejecuta Log a Wallet Transaction",
        }),
        "settings.wallet.automationRow": t({
            en: "Automation in Shortcuts",
            es: "Automatización en Atajos",
        }),
        "settings.wallet.cardsFooter": t({
            en: "Each card you tap with shows up here. Its taps go to the account you choose.",
            es: "Cada tarjeta con la que pagas aparece aquí. Sus pagos van a la cuenta que elijas.",
        }),
        "settings.wallet.cardsSection": t({
            en: "Cards",
            es: "Tarjetas",
        }),
        "settings.wallet.chooseAccount": t({
            en: "Choose an account",
            es: "Elige una cuenta",
        }),
        "settings.wallet.get": t({
            en: "Get the shortcut",
            es: "Obtener el atajo",
        }),
        "settings.wallet.getAgain": t({
            en: "Get the shortcut again",
            es: "Obtener el atajo de nuevo",
        }),
        "settings.wallet.getDetail": t({
            en: "Installs the whole automation with one tap. Then turn it on.",
            es: "Instala la automatización completa con un toque. Luego actívala.",
        }),
        "settings.wallet.hide": t({
            en: "Hide",
            es: "Ocultar",
        }),
        "settings.wallet.installed": t({
            en: "Shortcut installed",
            es: "Atajo instalado",
        }),
        "settings.wallet.lastSection": t({
            en: "Last from Wallet",
            es: "Último desde Wallet",
        }),
        "settings.wallet.lastTap": t({
            en: "Last tap {when}",
            es: "Último pago {when}",
        }),
        "settings.wallet.lead": t({
            en: "Every card tap lands on the Log, filed under the account it matches.",
            es: "Cada pago con tarjeta llega al registro, en la cuenta que coincida.",
        }),
        "settings.wallet.manualStep1": t({
            en: "Next, then New Blank Automation",
            es: "Siguiente, luego Nueva automatización en blanco",
        }),
        "settings.wallet.manualStep2": t({
            en: "Add Action, search Outlayr",
            es: "Agregar acción, busca Outlayr",
        }),
        "settings.wallet.manualStep2Detail": t({
            en: "Pick Log a Wallet Transaction",
            es: "Elige Log a Wallet Transaction",
        }),
        "settings.wallet.manualStep3": t({
            en: "Fill Amount, Merchant and Card",
            es: "Completa Amount, Merchant y Card",
        }),
        "settings.wallet.manualStep3Detail": t({
            en: "Tap each, choose Shortcut Input, then the matching field",
            es: "Toca cada uno, elige Entrada de atajo y luego el campo que corresponde",
        }),
        "settings.wallet.manualStep3Detail27": t({
            en: "Tap each, pick the Wallet variable above the keyboard, then the matching field",
            es: "Toca cada uno, elige la variable de Wallet sobre el teclado y luego el campo que corresponde",
        }),
        "settings.wallet.noCards": t({
            en: "No cards yet",
            es: "Aún no hay tarjetas",
        }),
        "settings.wallet.nothingLogged": t({
            en: "Nothing logged yet",
            es: "Nada registrado aún",
        }),
        "settings.wallet.nothingYet": t({
            en: "Nothing yet",
            es: "Nada aún",
        }),
        "settings.wallet.notifStep2": t({
            en: "Pick Notification, then the app",
            es: "Elige Notificación y luego la app",
        }),
        "settings.wallet.notifStep2Detail": t({
            en: "Your bank's app",
            es: "La app de tu banco",
        }),
        "settings.wallet.notifStep3Detail": t({
            en: "Pick Log from a Notification",
            es: "Elige Log from a Notification",
        }),
        "settings.wallet.notifStep4": t({
            en: "Fill Title, Subtitle and Body",
            es: "Completa Title, Subtitle y Body",
        }),
        "settings.wallet.notifStep4Detail": t({
            en: "Tap each, pick the Notification variable above the keyboard, then the matching field",
            es: "Toca cada uno, elige la variable de Notificación sobre el teclado y luego el campo que corresponde",
        }),
        "settings.wallet.notifStep5": t({
            en: "Type the account name in Account",
            es: "Escribe el nombre de la cuenta en Account",
        }),
        "settings.wallet.notifStep5Detail": t({
            en: "The one this app's card belongs to",
            es: "La cuenta a la que pertenece la tarjeta de esa app",
        }),
        "settings.wallet.notificationFooter": t({
            en: "Any app that sends a purchase push works, one automation per app. The amount and merchant are read from the text. Keep one source per card: leave a card logged this way out of the Wallet automation, or every tap lands twice.",
            es: "Funciona con cualquier app que te mande una notificación de compra, con una automatización por app. El monto y el comercio se leen del texto. Usa una sola fuente por tarjeta: deja fuera de la automatización de Wallet las tarjetas que registras así, o cada pago se duplica.",
        }),
        "settings.wallet.notificationSection": t({
            en: "Or from a bank notification",
            es: "O desde una notificación del banco",
        }),
        "settings.wallet.open": t({
            en: "Open Shortcuts",
            es: "Abrir Atajos",
        }),
        "settings.wallet.pushNewPlace": t({
            en: "New place, tap to pick a category.",
            es: "Lugar nuevo, toca para elegir una categoría.",
        }),
        "settings.wallet.pushWhichAccount": t({
            en: "Which account is {card}? Tap to pick.",
            es: "¿Qué cuenta es {card}? Toca para elegirla.",
        }),
        "settings.wallet.ranAt": t({
            en: "The automation ran {when}",
            es: "La automatización se ejecutó {when}",
        }),
        "settings.wallet.setupSection": t({
            en: "Setup",
            es: "Configuración",
        }),
        "settings.wallet.shortcutName": t({
            en: "Outlayr - Apple Pay",
            es: "Outlayr - Apple Pay",
        }),
        "settings.wallet.show": t({
            en: "Show",
            es: "Ver",
        }),
        "settings.wallet.step1": t({
            en: "Automation, then +",
            es: "Automatización, luego +",
        }),
        "settings.wallet.step2": t({
            en: "Choose Wallet",
            es: "Elige Wallet",
        }),
        "settings.wallet.step2Detail": t({
            en: "Called Transaction before iOS 26",
            es: "Se llama Transacción antes de iOS 26",
        }),
        "settings.wallet.step3": t({
            en: "Pick your cards",
            es: "Elige tus tarjetas",
        }),
        "settings.wallet.step3Detail": t({
            en: "Run Immediately on, Notify When Run off",
            es: "Ejecutar de inmediato activado, Notificar al ejecutar desactivado",
        }),
        "settings.wallet.step5": t({
            en: "Done",
            es: "Listo",
        }),
        "settings.wallet.stepsSection": t({
            en: "Turn it on in Shortcuts",
            es: "Actívalo en Atajos",
        }),
        "settings.wallet.tryIt": t({
            en: "Tap a card to try it",
            es: "Paga con una tarjeta para probarlo",
        }),
        "settings.wallet.unattached": t({
            en: "No account",
            es: "Sin cuenta",
        }),
        "settings.wallet.v27Manual1": t({
            en: "New shortcut, then search Automation",
            es: "Nuevo atajo, luego busca Automatización",
        }),
        "settings.wallet.v27Manual2": t({
            en: "Pick Wallet",
            es: "Elige Wallet",
        }),
        "settings.wallet.v27Manual2Detail": t({
            en: "Any Card is fine. Automation is already on and Notify off.",
            es: "Cualquier tarjeta sirve. Automatización ya viene activada y Notificar desactivado.",
        }),
        "settings.wallet.v27Step1": t({
            en: "Library, then Automation",
            es: "Biblioteca, luego Automatización",
        }),
        "settings.wallet.v27Step1Detail": t({
            en: "A shared automation arrives turned off",
            es: "Una automatización compartida llega desactivada",
        }),
        "settings.wallet.v27Step2": t({
            en: "Turn on Outlayr - Apple Pay",
            es: "Activa Outlayr - Apple Pay",
        }),
    },
    key: "settings-wallet" as const,
} satisfies Dictionary;

export default settingsWallet;
