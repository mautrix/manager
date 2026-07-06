import { defineConfig } from "vite"

export default defineConfig({
	build: {
		rolldownOptions: {
			external: [
				"@beeper/webauthn-authenticator",
				/^@beeper\/webauthn-authenticator-.+/,
			],
		},
	},
})
