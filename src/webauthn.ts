import * as webauthn from "@beeper/webauthn-authenticator"
import { ipcMain } from "electron"
import type { LoginWebAuthnParams } from "./types/loginstep"

ipcMain.handle("mautrix:webauthn", async (event, args: LoginWebAuthnParams) => {
	const origin = new URL(args.url).origin
	try {
		const backends = webauthn.supportedBackends()
		if (backends.includes("win10")) {
			return await webauthn.win10Authenticate(
				origin,
				{ publicKey: args.publicKey },
			)
		} else if (backends.includes("cable")) {
			const res = await webauthn.cableAuthenticate(
				origin,
				{ publicKey: args.publicKey },
				cablevt => event.sender.send("mautrix:webauthn:cable-ui", cablevt),
			)
			return {
				clientExtensionResults: {},
				authenticatorAttachment: "cross-platform",
				...res,
			}
		}
	} catch (err) {
		throw new Error(`${(err as Error)?.message ?? err}`)
	}
	throw new Error("No supported WebAuthn backend found")
})
