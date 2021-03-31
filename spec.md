# the chugsplash spec

## goals

1. Create a deployment system that:
    1. Makes deployments easy to design and parse.
    2. Makes deployments easy to secure.
    3. Makes deployments easy to track.

## components high level

1. The `DeploymentManager`, a smart contract that allows an address to authorize the execution of a series of actions (one of contract creation or contract interaction).
2. A basic JSON file structure for defining a series of actions for the `DeploymentManager` to take (+ the tooling to interact with this structure).
3. A workflow for generating, reviewing, and approving a bundle of actions.
4. A system for reliably executing actions once they have been approved.

## code reference

### functions we assume exist

```ts
function getContractInitcode(contract: string, arguments: any[]): bytes
```

```ts
function getCreate2Address(creator: address, initcode: bytes, salt: bytes32): address
```

```ts
function keccak256(input: bytes): bytes32
```

```ts
function solidityAbiEncode(input: any): bytes
```

```ts
function abiEncodeFunctionData(function: string, arguments: any[]): bytes
```

### core stuff

```ts
interface ChugSplashAction {
    isCreate: bool
    target: address
    gas: number
    data: bytes
}
```

```ts
interface BundledChugSplashAction extends ChugSplashAction {
    nextBundledActionHash: bytes32
}
```

```ts
function hash(bundledAction: BundledChugSplashAction): bytes32 {
    return keccak256(
        solidityAbiEncode([
            bundledAction.isCreate,
            bundledAction.target,
            bundledAction.gas,
            bundledAction.data,
            bundledAction.nextActionHash
        ])
    )
}
```

```ts
function bundle(actions: ChugSplashAction[]): BundledChugSplashAction[] {
    // 0xFFFF.... is the bundle terminating hash.
    let nextBundledActionHash = "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"

    let bundledActions = []
    // We have to bundle in reverse because the last action needs to be the bottom element of the
    // hash onion and must therefore have the 0xFFFF.... hash.
    for (const action of actions.reverse()) {
        const bundledAction = {
            isCreate: action.isCreate,
            target: action.target,
            gas: action.gas,
            data: action.data,
            nextBundledActionHash: nextBundledActionHash
        }

        bundledActions.push(bundledAction)
        // Now we hash the action and use that as the nextBundledActionHash for the next action.
        nextBundledActionHash = hash(bundledAction)
    }

    // Finally re-reverse it so it's back in the original action order.
    return bundledActions.reverse()
}
```

```ts
interface CreateActionDef {
    action: "create"
    contract: string
    nickname: string
    gas: number
    arguments: any[]
}
```

```ts
interface CallActionDef {
    action: "call"
    contract: string
    gas: number
    function: string
    arguments: any[]
}
```

```ts
interface ChugSplashActionBundleDef {
    nonce: number
    actions: Array<CreateActionDef | CallActionDef>
    declarations: {
        [contract: string]: address
    }
}
```

```ts
function bundleFromDef(
    bundleDef: ChugSplashActionBundleDef,
    deploymentManager: address
): BundledChugSplashAction[] {
    const declarations = bundleDef.declarations

    let deployCount = 0
    let actions: ChugSplashAction = []
    for (const actionDef of bundleDef.actions) {
        // Simple templating, $NICKNAME resolves to address of contract with nickname==NICKNAME.
        const arguments = []
        for (const argument of actionDef.arguments) {
            if (typeof argument === "string" && argument[0] === "$") {
                arguments.push(declarations[argument[1:]])
            } else {
                arguments.push(argument)
            }
        }

        if (actionDef.action === "deploy") {
            // Must make sure to increase the deploy count. Used to determine contract addresses.
            deployCount++

            // Compute deployment initcode using ABI + arguments.
            const data = getContractInitcode(actionDef.contract, actionDef.arguments)

            // Compute address. DeploymentManager will use CREATE2 matching this definition:
            declarations[actionDef.nickname] = getCreate2Address(
                deploymentManager,
                data,
                keccak256(
                    solidityAbiEncode([
                        bundleDef.nonce,
                        deployCount
                    ])
                )
            )

            actions.push({
                isCreate: true,
                target: "0x0000000000000000000000000000000000000000",
                gas: actionDef.gas,
                data: data,
            })
        } else if (actionDef.action === "call") {
            // Compute data using ABI + arguments.
            const data = abiEncodeFunctionData(actionDef.function, actionDef.args)

            actions.push({
                isCreate: false,
                target: bundleDef.delcarations[actionDef.contract],
                gas: actionDef.gas,
                data: data,
            })
        }
    }

    return bundle(actions)
}
```
