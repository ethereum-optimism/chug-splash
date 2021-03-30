# chugsplash

## >> big red warning sign <<
This code is a work in progress.
It is not even close to ready.
But we're working on it in the open because it's fun to do.
We'll update this with relevant install information once an actual release has been published.

## What is chugsplash?
`chugsplash` is a smart contract deployment system that attempts to optimize for security and usibility.
At the core of `chugsplash` is the idea that a deployment or upgrade should take the form of a single atomic action.
This ideology asks that developers design their deployments carefully and deliberately.
The reward of doing so is a massive boost to both operational security and long-term maintainability.

## Another smart contract deployment system????
Not just any smart contract deployment system. **`chugsplash`**.

## Why should I care?
Do you want to get rekt? 
Didn't think so.
`chugsplash` keeps you from getting rekt.

People get rekt because **securing and managing complex smart contract deployments is hard**.
But it shouldn't be hard to keep you, your project, and your users safe.

`chugsplash` makes security easy by creating a distinction between transaction *authorization* and transaction *execution*.
Here at `chugsplash labs` (a totally real company, rest assured) we believe that **deployments and upgrades should take the form of a single, atomic, and highly intentional action**.
You should know *exactly* what you're about to send off to Ethereum.
And once you do know what you're going to do, the whole thing should *reliably* happen.

Each `chugsplash` deployment is authorized by a call to:

```solidity
function approveTransactionBundle(
    bytes32 _transactionBundleHash
)
    public
    onlyOwner
{
    ...
}
```

See that?
It's you're basically just **signing a single 32 byte hash and it authorizes the entire deployment**.
`_transactionBundleHash` is a simple 32 byte hash onion commitment to a series of transactions.
We generate the hash onion from the bundle of transactions that you want to execute during the course of your deployment.
We'll get to the exact details of the hash onion in a second.
First we need to describe the basic `chugsplash` transaction structure.

The `TransactionBundleExecutor` can either create a new contract or call an existing contract.
Each "action" that you want to take is defined by:

```ts
{
    to: null | hex,
    data: hex,
    gasLimit: number
}
```

If `to` is null, then this action is a deployment.
Otherwise, this is a contract call.
Since we there's no such thing as `null` in solidity, we add an extra field `_isCreate`.
The final transaction structure is summed up well by the function used to execute them:

```solidity
function executeTransaction(
    bytes32 _nextTransactionHash, // one sec, we'll get to this!
    bool _isCreate, // are we creating or calling?
    address _target, // if calling, who to call?
    uint256 _gasLimit, // how much gas should we be using
    bytes memory _data // data to send to call or to deploy with
)
    public
{
    ...
}
```

You call this function over and over and the whole deployment happens.
But how does the contract know that the thing being executed was actually authenticated?
With the magic of ~hash onions~.

So let's actually explain hash onions.
Note first that when you want to execute a transaction via this function you have to pass the following check:

```solidity
require(
    keccak256(
        abi.encode(
            _nextTransactionHash,
            _isCreate,
            _target,
            _gasLimit,
            _data
        )
    ) == nextTransactionHash,
    "TransactionBundleExecutor: computed transaction hash does not match next transaction hash"
);
```

Pretty straightforward here, we're committing to the hash of the transaction.
As long as the hash matches up we'll know that this is exactly what the user wanted to execute.
Here's where that extra `nextTransactionHash` thing comes in.
The initial `transactionBundleHash` is a commitment to both the transaction and to a hash of the *next* transaction (+ a hash for the next next transaction, and so on).
Once a transaction passes the above check, we simply run:

```solidity
nextTransactionHash = _nextTransactionHash;
```

And repeat the process all over again!
Eventually some transaction will have a terminating hash (we use 0x00000...).
At this point there's no way to generate a valid transaction to be executed and the bundle is finished.
Nice.

### Maintaining Atomicity
One key feature of `TransactionBundleExecutor` is that deployments must be executed completely.
A new bundle cannot be processed until the previous bundle has been fully executed.
// sorry I need to finish this readme later.