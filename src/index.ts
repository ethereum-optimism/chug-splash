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
  makeRawTransactions,
  makeTextBoxy,
  makeTransactionBundle,
} from './helpers'
import './type-extensions'

const TASK_CHUGSPLASH_GET_DEPLOYMENT = 'chugsplash:get-deployment'
const TASK_CHUGSPLASH_GET_EXECUTOR = 'chugsplash:get-executor'
const TASK_CHUGSPLASH_BUNDLE = 'chugsplash:bundle'
const TASK_CHUGSPLASH_APPROVE = 'chugsplash:approve'
const TASK_CHUGSPLASH_DISPLAY_DEPLOYMENT = 'chugsplash:view'

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
      let text = ''
      if (tx.action === 'deploy') {
        text += `Action #${i + 1}: Contract DEPLOYMENT\n`
        text +=
          '*******************************************************************************\n'
        text += `Contract: ${tx.contract}\n`
        if (tx.name) {
          text += `Contract Alias: ${tx.name}\n`
        }
        text += `Gas Limit: ${tx.gasLimit}\n`
        if (tx.arguments && tx.arguments.length > 0) {
          text += `Constructor Arguments:\n`
          for (let j = 0; j < tx.arguments.length; j++) {
            text += `   ${j + 1}. ${tx.arguments[j]}\n`
          }
        } else {
          text += `Constructor Arguments:\n`
          text += `   >> NO ARGUMENTS PROVIDED <<\n`
        }
      }
      if (tx.action === 'call') {
        text += `Action #${i + 1}: Contract CALL\n`
        text +=
          '*******************************************************************************\n'
        text += `Contract: ${tx.target}\n`
        text += `Gas Limit: ${tx.gasLimit}\n`
        text += `Function Name: ${tx.function}\n`
        if (tx.arguments && tx.arguments.length > 0) {
          text += `Function Arguments:\n`
          for (let j = 0; j < tx.arguments.length; j++) {
            text += `   ${j + 1}. ${tx.arguments[j]}\n`
          }
        } else {
          text += `Function Arguments:\n`
          text += `   >>NO ARGUMENTS PROVIDED<<\n`
        }
      }
      console.log(text)
    }

    console.log()
    console.log(`Deployment Summary`)
    console.log(
      '*******************************************************************************'
    )
    console.log(`Total Transactions: ${bundle.transactions.length}`)
    console.log(`Bundle Hash: ${bundle.hash}`)
    console.log()
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
    console.log('\n\n')
    console.log(makeTextBoxy('!!! DANGER ZONE !!!'))
    console.log('\n\n')
    console.log('You are about to approve a transaction bundle.')

    if (
      (await yesno({
        question: `Do you know what you're doing?`,
      })) === false
    ) {
      console.log('Safety first!')
      return
    }

    console.log('\n')
    await hre.run(TASK_CHUGSPLASH_DISPLAY_DEPLOYMENT, args)
    console.log('\n')

    console.log('Please review the above bundle *carefully* before approving.')
    if (
      (await yesno({
        question: `Do you really want to approve this bundle?`,
      })) === false
    ) {
      console.log('Safety first!')
      return
    }

    console.log(
      `You approved this bundle. Giving you five seconds to change your mind...`
    )
    for (let i = 5; i > 0; i--) {
      console.log(`${i}...`)
      await sleep(1000)
    }

    console.log(`Submitting approval transaction.`)
    console.log(
      `If using a hardware wallet, check your wallet for a transaction.`
    )
    const result = await executor.approveTransactionBundle(bundle.hash)
    console.log(`Transaction submitted.`)
    console.log(`Transaction hash: ${result.hash}`)
    console.log(`Waiting for transaction to be mined...`)
    await result.wait()
    console.log(`Transaction mined. All done!`)
  })
