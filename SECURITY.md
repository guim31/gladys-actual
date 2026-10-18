# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

The integration holds the password of the Actual server, which gives access to every budget on it,
and the encryption password of the budget when it is end-to-end encrypted. Gladys stores them with
the configuration and passes them to the container; the integration only sends them to the address
of the Actual server given in the configuration (through the official `@actual-app/api` package)
and never writes them to the logs. It never writes to the budget. Under `/data`, it keeps a local
copy of the budget, as the Actual app does (not encrypted, even for an end-to-end encrypted budget;
removed at every start and when another server or budget is configured), and which scene trigger
levels were fired (identifiers, months and levels, no amount or name). It talks to the Actual server
only, on the network of the user.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services and devices the integration talks to.
