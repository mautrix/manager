import { existsSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { listPackage } = require("@electron/asar")

const nativePackageByTarget = {
	"darwin-arm64": "webauthn-authenticator-darwin-arm64",
	"darwin-x64": "webauthn-authenticator-darwin-x64",
	"linux-arm64": "webauthn-authenticator-linux-arm64-gnu",
	"linux-x64": "webauthn-authenticator-linux-x64-gnu",
	"win32-arm64": "webauthn-authenticator-win32-arm64-msvc",
	"win32-x64": "webauthn-authenticator-win32-x64-msvc",
}

function findFiles(root, basename) {
	if (!existsSync(root)) {
		return []
	}
	const matches = []
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const entryPath = path.join(root, entry.name)
		if (entry.isDirectory()) {
			matches.push(...findFiles(entryPath, basename))
		} else if (entry.name === basename) {
			matches.push(entryPath)
		}
	}
	return matches
}

const target = `${process.platform}-${process.arch}`
const nativePackage = nativePackageByTarget[target]
if (!nativePackage) {
	throw new Error(`Unsupported package verification target: ${target}`)
}

const asarPaths = findFiles(path.resolve("out"), "app.asar")
if (asarPaths.length !== 1) {
	throw new Error(`Expected exactly one packaged app.asar, found ${asarPaths.length}`)
}

const asarPath = asarPaths[0]
const entries = new Set(listPackage(asarPath))
const requiredEntries = [
	"/node_modules/@beeper/webauthn-authenticator/package.json",
	"/node_modules/@beeper/webauthn-authenticator/index.js",
	`/node_modules/@beeper/${nativePackage}/package.json`,
]
for (const entry of requiredEntries) {
	if (!entries.has(entry)) {
		throw new Error(`Packaged app is missing ${entry}`)
	}
}

const nativeRoot = `${asarPath}.unpacked/node_modules/@beeper/${nativePackage}`
const nativeBinaries = existsSync(nativeRoot)
	? readdirSync(nativeRoot)
		.filter((name) => name.endsWith(".node"))
		.map((name) => path.join(nativeRoot, name))
		.filter((file) => statSync(file).isFile())
	: []
if (nativeBinaries.length !== 1) {
	throw new Error(`Expected one unpacked native WebAuthn binary, found ${nativeBinaries.length}`)
}

console.log(`Verified packaged WebAuthn dependency for ${target}`)
