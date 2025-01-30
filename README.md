# mautrix-manager
An Electron app to help with logging into bridges.

All bridges using the new bridgev2 framework in mautrix-go are supported, as
well as any bridges implementing the same provisioning API. Note that old
mautrix bridges are not supported.

## Discussion
Matrix room: [#manager:maunium.net](https://matrix.to/#/#manager:maunium.net)

## Auto-configuration
You can always add bridge URLs inside mautrix-manager, but to make setup easier
for users, the server admin can configure a `.well-known` file which is used to
auto-discover available bridges.

On startup, mautrix-manager will fetch `/.well-known/matrix/mautrix` and read a
list of URLs in the `fi.mau.bridges` property. For example, if you had Signal
and Slack bridges and `bridges.example.com` configured to proxy `/signal/*` and
`/slack/*` to the corresponding bridges, you'd probably want a well-known file
like this:

```json
{
  "fi.mau.bridges": [
    "https://bridges.example.com/signal",
    "https://bridges.example.com/slack"
  ]
}
```

The list MUST NOT include bridges that are connected to other servers, as the
manager will send your Matrix access token to the bridges. If you want to add
bridges on other servers, use the `fi.mau.external_bridge_servers` property
instead. When specified, mautrix-manager will go through the list and fetch the
.well-known file for each server. It will not recurse into the external servers
list of an already-external server.

```json
{
  "fi.mau.external_bridge_servers": [
    "anotherserver.example.org"
  ]
}
```

For bridges on external servers, the manager will generate an OpenID token and
exchange it for a temporary bridge-specific auth token rather than sending your
Matrix access token to the bridge.

## Running the arm64 Built Binary

To run the arm64 built binary on M1 and higher Macs, after installing mautrix-manager.app in /Applications, enter the following command in terminal: `xattr -d com.apple.quarantine /Applications/mautrix-manager.app`.
