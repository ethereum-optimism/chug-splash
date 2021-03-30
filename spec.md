# The chugsplash spec

this is also a work in progress, but i am required to do it so i will do it!

This is the spec for `chugsplash`, a smart contract deployment system.
Smart contract deployment systems are hard.
Solutions to hard problems need specs!

## Deployment definition files
`chugsplash` deployments are defined by clear deployment json files.
Deployment files can be described by the following TypeScript interface:

```ts
interface DeploymentDefinition {
    nonce: number
    transactions: Array<DeployTransaction | CallTransaction>
}
```

All deployments **must** have a `nonce` which dictates exactly when a particular deployment can be executed.
The deployment with nonce `n` **cannot** be executed until the deployment with nonce `n-1` has been fully executed.
This holds true for all `n` except for the first deployment which must have a nonce `n=1` and can be executed at any time.

The `TransactionBundleExecutor` can take two possible actions, deployments or contract interactions.
This is reflected in the `transactions` field of the deployment definition, which must either be a `DeployTransaction` or a `CallTransaction`.

A `DeployTransaction` takes the form:

```ts
interface DeployTransaction {
    action: "deploy"
    contract: string // NAME of the contract to deploy
    nickname: string
    gasLimit: number
    arguments: any[]
}
```

A `CallTransaction` takes the form:

```ts
interface CallTransaction {
    action: "call"
    target: string // NAME of the contract to call
    gasLimit: number
    function: string
    arguments: any[]
}
```

**Note** that all fields in these two transaction types are required.
This is done explicitly to avoid any sort of confusion or uncertainty.
Chugsplash *will* complain and throw errors if you don't fill in every relevant field

Here's an example deployment file:

```json
{
    "nonce": 1,
    "transactions": [
        [
            {
                "action": "deploy",
                "contract": "MyContract",
                "nickname": "MyContract-1",
                "gasLimit": 4000000,
                "arguments": []
            },
            {
                "action": "deploy",
                "contract": "MyContractWithArgs",
                "nickname": "MyContractWithArgs-1",
                "gasLimit": 4000000,
                "arguments": [
                    1234,
                    "some string argument",
                ]
            },
            {
                "action": "call",
                "target": "MyContract-1",
                "function": "myContractFunction",
                "gasLimit": 4000000,
                "arguments": [
                    5678,
                    "use templates to refer to previous deployments:",
                    "{MyContract-1}.address"
                ]
            }
        ]

    ]
}
```
