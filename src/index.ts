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

    console.log(`Approving transaction bundle.`)
    console.log(`Submitting approval transaction...`)
    const result = await executor.approveTransactionBundle(bundle.hash)
    console.log(`Submitted approval transaction.`)
    console.log(`Transaction hash: ${result.hash}`)
    console.log(`Waiting for transaction to be mined...`)
    await result.wait()
    console.log(`Transaction mined. All done!`)
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

    // how to handle nonce changes?
    const getNextTransactionIndex = async (): Promise<number> => {
      // first, check to see if we're in the bundle by searching for the current bundle hash.
      const nextTransactionHash = await executor.nextTransactionHash()
      console.log(nextTransactionHash)
      let index = -1
      for (let i = 0; i < bundle.transactions.length; i++) {
        const tx = bundle.transactions[i]
        const txHash = getTransactionHash(tx)
        console.log(txHash)
        if (txHash === nextTransactionHash) {
          index = i
        }
      }
      return index
    }

    // main problem here is that we need to use the correct nonce

    // user starts trying to send transactions
    // > in the future we could consider adding some sort of "lock" to this; not sure.
    // > could possibly also ask that the user give expected next tx hash to reduce gas cost.
    // TODO: a LOT of error handling here
    let backoff = 0
    let nextTransactionIndex = await getNextTransactionIndex()
    if (nextTransactionIndex === -1) {
      console.log(
        `Provided deployment is not active. Are you sure you have the right deployment?`
      )
      return
    }

    while (nextTransactionIndex < bundle.transactions.length) {
      // if we aren't in the right bundle, let the user know and exit
      if (nextTransactionIndex === -1) {
        console.log(`Deployment has been successfully executed.`)
        break
      }

      try {
        const tx = bundle.transactions[nextTransactionIndex]

        console.log(
          `Attempting to execute bundle transaction #${
            nextTransactionIndex + 1
          }`
        )
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
          backoff = 0
        } catch (err) {
          backoff += backoff * 2 + 30000 + Math.floor(Math.random() * 15000)
          console.log(
            `Transaction execution failed. Someone else probably executed this transaction already.`
          )
        }
      } catch (err) {
        // todo: catch here?
        throw err
      } finally {
        const prevTransactionIndex = nextTransactionIndex
        nextTransactionIndex = await getNextTransactionIndex()
        if (nextTransactionIndex !== prevTransactionIndex + 1) {
          console.log(`Transaction index did not increment after transaction.`)
          console.log(
            `Waiting 30 seconds to attempt to self-correct, then will continue.`
          )
          await sleep(30000)
        }

        if (backoff > 0) {
          console.log(`Backing off, will wait ${backoff}ms`)
          await sleep(backoff)
        }
      }
    }

    // by default, write artifacts after the deploy
  })

// todo
// > task to generate artifacts
// > use versioning + compare to git for security (?)
