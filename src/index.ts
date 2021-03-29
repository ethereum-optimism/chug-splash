/* Imports: External */
import { sleep } from '@eth-optimism/core-utils'
import { ethers } from 'ethers'
import { task, types } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import * as path from 'path'
import yesno from 'yesno'

/* Imports: Internal */
import {
  getTransactionExecutorFactory,
  getTransactionHash,
  makeRawTransactions,
  makeTextBoxy,
  makeTransactionBundle,
} from './helpers'
import './type-extensions'
import { TransactionBundle } from './types'

const TASK_CHUGSPLASH_GET_DEPLOYMENT = 'chugsplash:get-deployment'
const TASK_CHUGSPLASH_GET_EXECUTOR = 'chugsplash:get-executor'
const TASK_CHUGSPLASH_BUNDLE = 'chugsplash:bundle'
const TASK_CHUGSPLASH_VERIFY_BUNDLE_HASH = 'chugsplash:verify'
const TASK_CHUGSPLASH_EXECUTE = 'chugsplash:execute'
const TASK_CHUGSPLASH_APPROVE = 'chugsplash:approve'
const TASK_CHUGSPLASH_DISPLAY_DEPLOYMENT = 'chugsplash:view'
const TASK_CHUGSPLASH_DEPLOY_EXECUTOR = 'chugsplash:deploy-executor'

task(TASK_CHUGSPLASH_GET_DEPLOYMENT)
  .addParam(
    'deployment',
    'Path to deployment definition JSON file.',
    undefined,
    types.string
  )
  .setAction(async (args) => {
    // todo; assertions about this object
    return require(path.resolve(process.cwd(), args.deployment))
  })

task(TASK_CHUGSPLASH_GET_EXECUTOR)
  .addOptionalParam(
    'executor',
    'Address of the TransactionBundleExecutor that will execute the deployment.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'from',
    'Address to send transactions from. Defaults to first available account if one exists.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    return getTransactionExecutorFactory(
      hre.ethers.provider.getSigner(args.from || 0)
    ).attach(
      hre.config.chugSplash?.executor ||
        args.executor ||
        ethers.constants.AddressZero
    )
  })

task(TASK_CHUGSPLASH_BUNDLE)
  .addParam(
    'deployment',
    'Path to deployment definition JSON file.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'executor',
    'Address of the TransactionBundleExecutor that will execute the deployment.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    const deployment = await hre.run(TASK_CHUGSPLASH_GET_DEPLOYMENT, args)
    const executor = await hre.run(TASK_CHUGSPLASH_GET_EXECUTOR, args)
    const rawTxs = await makeRawTransactions(hre, deployment, executor.address)
    return makeTransactionBundle(rawTxs)
  })

task(TASK_CHUGSPLASH_DEPLOY_EXECUTOR)
  .addOptionalParam(
    'from',
    'Address to send transactions from. Defaults to first available account if one exists.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'owner',
    'Address that will own the TransactionBundleExecutor.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    const signer = hre.ethers.provider.getSigner(args.from || 0)
    const owner = args.owner || (await signer.getAddress())
    const factory = getTransactionExecutorFactory(signer)

    console.log(`Deploying new TransactionBundleExecutor.`)
    console.log(`Owner: ${owner}`)
    console.log(`Submitting deploy transaction...`)
    const contract = await factory.deploy(owner)
    console.log(`Submitted deploy transaction.`)
    console.log(`Transaction hash: ${contract.deployTransaction.hash}`)
    console.log(`Waiting for transaction to be mined...`)
    await contract.deployTransaction.wait()
    console.log(`Transaction mined. All done!`)
    console.log(`TransactionBundleExecutor address: ${contract.address}`)
  })

task(TASK_CHUGSPLASH_APPROVE)
  .addParam(
    'deployment',
    'Path to deployment definition JSON file.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'executor',
    'Address of the TransactionBundleExecutor that will execute the deployment.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'from',
    'Address to send transactions from. Defaults to first available account if one exists.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    const executor = await hre.run(TASK_CHUGSPLASH_GET_EXECUTOR, args)
    const bundle = await hre.run(TASK_CHUGSPLASH_BUNDLE, args)

    await executor.approveTransactionBundle(bundle.hash)
  })

task(TASK_CHUGSPLASH_DISPLAY_DEPLOYMENT)
  .addParam(
    'deployment',
    'Path to deployment definition JSON file.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'executor',
    'Address of the TransactionBundleExecutor that will execute the deployment.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    const deployment = await hre.run(TASK_CHUGSPLASH_GET_DEPLOYMENT, args)
    const bundle = await hre.run(TASK_CHUGSPLASH_BUNDLE, args)

    console.log()
    for (let i = 0; i < deployment.length; i++) {
      const tx = deployment[i]

      if (tx.action === 'deploy') {
        console.log(`Action #${i + 1}: Contract DEPLOYMENT`)
        console.log(`*`.repeat(79))
        console.log(`Contract: ${tx.contract}`)
        if (tx.name) {
          console.log(`Contract Alias: ${tx.name}`)
        }
        console.log(`Gas Limit: ${tx.gasLimit}`)
        if (tx.arguments && tx.arguments.length > 0) {
          console.log(`Constructor Arguments:`)
          for (let j = 0; j < tx.arguments.length; j++) {
            console.log(`   ${j + 1}. ${tx.arguments[j]}`)
          }
        } else {
          console.log(`Constructor Arguments:`)
          console.log(`   >> NO ARGUMENTS PROVIDED <<`)
        }
      }

      if (tx.action === 'call') {
        console.log(`Action #${i + 1}: Contract CALL`)
        console.log(`*`.repeat(79))
        console.log(`Contract: ${tx.target}`)
        console.log(`Gas Limit: ${tx.gasLimit}`)
        console.log(`Function Name: ${tx.function}`)
        if (tx.arguments && tx.arguments.length > 0) {
          console.log(`Function Arguments:`)
          for (let j = 0; j < tx.arguments.length; j++) {
            console.log(`   ${j + 1}. ${tx.arguments[j]}`)
          }
        } else {
          console.log(`Function Arguments:`)
          console.log(`   >>NO ARGUMENTS PROVIDED<<`)
        }
      }
    }

    console.log()
    console.log(`Deployment Summary`)
    console.log(`*`.repeat(79))
    console.log(`Total Transactions: ${bundle.transactions.length}`)
    console.log(`Bundle Hash: ${bundle.hash}`)
    console.log()
  })

task(TASK_CHUGSPLASH_VERIFY_BUNDLE_HASH)
  .addParam(
    'deployment',
    'Path to deployment definition JSON file.',
    undefined,
    types.string
  )
  .addParam(
    'bundle',
    '32 byte 0x-prefixed hash of the bundle to be verified.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'executor',
    'Address of the TransactionBundleExecutor that will execute the deployment.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    const bundle = await hre.run(TASK_CHUGSPLASH_BUNDLE, args)
    if (bundle.hash === args.bundle) {
      console.log(`OK: Provided bundle hash is valid!`)
    } else {
      console.log(`ERROR: Provided bundle hash is invalid!`)
      console.log(`Provided bundle hash: ${args.bundle}`)
      console.log(`Computed bundle hash: ${bundle.hash}`)
    }
  })

task(TASK_CHUGSPLASH_EXECUTE)
  .addParam(
    'deployment',
    'Path to deployment definition JSON file.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'executor',
    'Address of the TransactionBundleExecutor that will execute the deployment.',
    undefined,
    types.string
  )
  .addOptionalParam(
    'from',
    'Address to send transactions from. Defaults to first available account if one exists.',
    undefined,
    types.string
  )
  .setAction(async (args, hre: HardhatRuntimeEnvironment & { ethers: any }) => {
    const executor = await hre.run(TASK_CHUGSPLASH_GET_EXECUTOR, args)
    const bundle: TransactionBundle = await hre.run(
      TASK_CHUGSPLASH_BUNDLE,
      args
    )

    // first, check to see if we're in the bundle by searching for the current bundle hash.
    const nextTransactionHash = await executor.nextTransactionHash()
    let nextTransactionIndex = -1
    for (let i = 0; i < bundle.transactions.length; i++) {
      const tx = bundle.transactions[i]
      const txHash = getTransactionHash(tx)
      if (txHash === nextTransactionHash) {
        nextTransactionIndex = i
      }
    }

    // if we aren't in the right bundle, let the user know and exit
    if (nextTransactionIndex === -1) {
      console.log(
        `Provided deployment is not active. Are you sure you have the right deployment?`
      )
      return
    }

    // user starts trying to send transactions
    // > in the future we could consider adding some sort of "lock" to this; not sure.
    // > could possibly also ask that the user give expected next tx hash to reduce gas cost.
    // TODO: a LOT of error handling here
    let backoff = 0
    while (nextTransactionIndex < bundle.transactions.length) {
      const tx = bundle.transactions[nextTransactionIndex]
      if (backoff > 0) {
        console.log(`Backing off, will wait ${backoff}ms`)
        await sleep(backoff)
      }

      console.log(
        `Attempting to execute bundle transaction #${nextTransactionIndex + 1}`
      )
      const nextTransactionHash = await executor.nextTransactionHash()
      const thisTransactionHash = getTransactionHash(tx)
      if (nextTransactionHash !== thisTransactionHash) {
        console.log(nextTransactionHash)
        console.log(thisTransactionHash)
        // console.log(
        //   `Transaction was already executed by somebody else. Skipping.`
        // )
        // nextTransactionIndex += 1
        // continue
      }

      try {
        console.log(`Submitting transaction...`)
        const result = await executor.executeTransaction(
          tx.nextTransactionHash,
          tx.isCreate,
          tx.target,
          tx.gasLimit,
          tx.data,
          {
            gasLimit: tx.gasLimit + 100_000,
          }
        )
        console.log(`Submitted transaction.`)
        console.log(`Transaction hash: ${result.hash}`)
        console.log(`Waiting for transaction to be mined...`)
        await result.wait()
        console.log(`Transaction mined!`)
        nextTransactionIndex += 1
      } catch (err) {
        backoff += (backoff + Math.floor(Math.random() * 5000)) * 2

        if (
          err.message.includes(
            'TransactionBundleExecutor: there is no active bundle'
          )
        ) {
          console.log(
            `Transaction was executed by someone else before we could execute it. Moving on.`
          )
          nextTransactionIndex += 1
          continue
        } else {
          console.log(
            `Transaction went wrong but couldn't figure out why. Trying again.`
          )
          continue
        }
      }
    }

    // if the user's transction fails, back off for a brief random period of time
    // keep submitting transactions to the end
    // by default, write artifacts after the deploy
  })

// todo
// > task to generate artifacts
// > use versioning + compare to git for security (?)
