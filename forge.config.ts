import { FuseV1Options, FuseVersion } from "@electron/fuses"
import { MakerDeb } from "@electron-forge/maker-deb"
import { MakerDMG } from "@electron-forge/maker-dmg"
import { MakerSquirrel } from "@electron-forge/maker-squirrel"
import { FusesPlugin } from "@electron-forge/plugin-fuses"
import { VitePlugin } from "@electron-forge/plugin-vite"
import { PublisherGithub } from "@electron-forge/publisher-github"
import type { ForgeConfig } from "@electron-forge/shared-types"

const config: ForgeConfig = {
	packagerConfig: {
		asar: {
			unpack: "**/*.node",
		},
		// Vite externalizes the native WebAuthn module, so Electron Packager must copy it.
		// Disable its dependency pruning and explicitly retain only this package and its
		// platform-specific optional dependency to avoid duplicating bundled modules.
		prune: false,
		ignore: (file) => Boolean(file && !(
			file.startsWith("/.vite")
			|| file === "/node_modules"
			|| file === "/node_modules/@beeper"
			|| file.startsWith("/node_modules/@beeper/webauthn-authenticator")
		)),
		protocols: [
			{
				name: "mautrix-manager",
				schemes: ["mautrix-manager"],
			},
		],
		extendInfo: {
			NSBluetoothAlwaysUsageDescription: "mautrix-manager uses bluetooth for passkeys",
		},
		icon: "icon",
		osxSign: {},
		osxNotarize: process.env.APPLE_API_KEY_PATH ? {
			appleApiKey: process.env.APPLE_API_KEY_PATH,
			appleApiKeyId: process.env.APPLE_API_KEY_ID!,
			appleApiIssuer: process.env.APPLE_API_ISSUER!,
		} : undefined,
	},
	rebuildConfig: {},
	makers: [
		new MakerSquirrel({}),
		new MakerDMG({}),
		new MakerDeb({
			options: {
				mimeType: ["x-scheme-handler/mautrix-manager"],
				icon: "icon.png",
			},
		}),
	],
	plugins: [
		new VitePlugin({
			build: [
				{
					// `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
					entry: "src/electron.ts",
					config: "vite.main.config.ts",
					target: "main",
				},
				{
					entry: "src/preload.ts",
					config: "vite.preload.config.ts",
					target: "preload",
				},
			],
			renderer: [
				{
					name: "main_window",
					config: "vite.renderer.config.ts",
				},
			],
		}),
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
	publishers: [
		new PublisherGithub({
			repository: {
				name: "manager",
				owner: "mautrix",
			},
			draft: true,
		}),
	],
}

export default config
