# The chugsplash spec

this is also a work in progress, but i am required to do it so i will do it!

This is the spec for `chugsplash`, a smart contract deployment system.
Smart contract deployment systems are hard.
Solutions to hard problems need specs!

## Transaction bundle executor
The `TransactionBundleExecutor` is the solidity smart contract that makes `chugsplash` possible.
The contract's name is pretty descriptive, it's a contract that makes it possible to execute bundles of transactions.
What is a transaction bundle?
A transaction bundle is a series of transactions that are executed by the contract (hence the name).

Each transaction can either be a CALL or a CREATE which pretty much allows you do do anything.
Transactions consist of the following fields:
1. `bool isCreate`: If true, this action is a contract creation. If false, this is a contract call.
2. `address target`: Contract to interact with. If `isCreate` is true then this field is ignored.
3. `uint256 gasLimit`: Gas to provide to this transaction.
4. `bytes data`: Data to send to the target contract or initcode if creating a new contract.
5. `bytes32 nextTransactionHash`: Hash of the next transaction (this is important).

Here's the same thing as a TypeScript-like interfcace:

```ts
interface BundledTransaction {
    isCreate: bool
    target: address
    gasLimit: number
    data: bytes
    nextTransactionHash: bytes32
}
```

The first four fields are relatively self-explanatory.
`nextTransactionHash` is a hash of the next transaction in the bundle to be executed.
This is what makes the bundle work.
Once a transaction is processed, we store this reference to the next transaction.
When someone attempts to execute a transaction, we verify that the hash of the thing they're trying to execute matches the `nextTransactionHash` provided by the previous transaction.

The function to compute the hash of a transaction is:
```ts
const computeTransactionHash = (
    transaction: BundledTransaction
): bytes32 => {
    return keccak256(
        abiEncode(
            transaction.isCreate
            transaction.target
            transaction.gasLimit
            transaction.data
            transaction.nextTransactionHash
        )
    )
}
```

Then there's a function on the `TransactionBundleExecutor` that allows you to execute a transaction:

```solidity
function executeBundledTransaction(
    BundledTransaction memory transaction
) public {
    ...
}
```

Transaction bundles are basically just a collection of these `BundledTransaction` objects.
Every bundle starts by making a list of these things, where the order of the list is the order in which the transactions will be executed.
Here's an example:

```ts
const bundle: BundledTransaction[] = [
    {
        target: null, // this will be a contract creation
        gasLimit: 1000000,
        data: "0x1234123412341234123412341234" // init code
    },
    {
        target: "0x1111111111111111111111111111111111111111", // but this is a contract call
        gasLimit: 250000,
        data: "0x5432543254325432"
    },
    ... // and so on
]
```

This clearly isn't very useful to humans because humans can't read bytecode.
Still, it's the basic transaction structure that we need at a lower level.


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

Here's an example json deployment file:

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
