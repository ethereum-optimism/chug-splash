/* Imports: External */
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Contract, ContractFactory, ethers } from 'ethers'
import { sleep } from '@eth-optimism/core-utils'
import { Signer } from '@ethersproject/abstract-signer'

/* Imports: Internal */
import {
  BundleTransaction,
  CompiledBundleTransaction,
  isCallTransaction,
  isDeployTransaction,
  RawBundleTransaction,
  TransactionBundle,
} from './types'

/**
 * Creates an ethers TransactionFactory object with the abi and bytecode of the
 * TransactionBundleExecutor contract.
 * @returns TransactionBundlExecutor factory.
 */
export const getTransactionExecutorFactory = (
  signer?: Signer
): ContractFactory => {
  const artifact = require('./artifacts/contracts/TransactionBundleExecutor.sol/TransactionBundleExecutor.json')
  return new ContractFactory(artifact.abi, artifact.bytecode, signer)
}

export const makeRawTransactions = async (
  hre: HardhatRuntimeEnvironment & { ethers: any },
  transactions: BundleTransaction[],
  executor: Contract
): Promise<RawBundleTransaction[]> => {
  let nonce: number
  if (await executor.hasActiveBundle()) {
    nonce = await executor.getActiveBundleNonce()
  } else {
    nonce = await hre.ethers.provider.getTransactionCount(executor.address)
  }

  const raw = []
  const contracts = {}
  for (const tx of transactions) {
    // Start by fixing any transaction arguments.
    const args = tx.arguments.map((arg) => {
      if (typeof arg === 'string' && arg.startsWith('{')) {
        const name = /\{(.*?)\}/g.exec(arg)[1]
        const field = /\.(.*?)$/g.exec(arg)[1]
        return contracts[name][field]
      } else {
        return arg
      }
    })

    if (isDeployTransaction(tx)) {
      const factory = await hre.ethers.getContractFactory(tx.contract)
      const data = factory.getDeployTransaction(...args).data
      const address = hre.ethers.utils.getContractAddress({
        from: executor.address,
        nonce: nonce,
      })

      nonce += 1
      contracts[tx.name || tx.contract] = factory.attach(address)
      raw.push({
        to: null,
        data: data,
        gasLimit: tx.gasLimit,
      })
    } else if (isCallTransaction(tx)) {
      const contract = contracts[tx.target]
      const data = contract.interface.encodeFunctionData(tx.function, args)

      raw.push({
        to: contract.address,
        data: data,
        gasLimit: tx.gasLimit,
      })
    } else {
      throw new Error('unrecognized bundled transaction type')
    }
  }

  return raw
}

/**
 * Computes the chugsplash hash for a bundle transaction.
 * @param tx Bundle transaction to hash.
 * @returns Hash of the transaction.
 */
export const getTransactionHash = (tx: CompiledBundleTransaction): string => {
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['bytes32', 'bool', 'address', 'uint256', 'bytes'],
      [tx.nextTransactionHash, tx.isCreate, tx.target, tx.gasLimit, tx.data]
    )
  )
}

// rename these functions.
export const makeTransactionBundle = (
  raw: RawBundleTransaction[]
): TransactionBundle => {
  let nextTransactionHash = '0x' + '11'.repeat(32) // BUNDLE_TERMINATING_HASH
  const compiledTxs: CompiledBundleTransaction[] = []
  for (const tx of raw.reverse()) {
    const compiledTx: CompiledBundleTransaction = {
      nextTransactionHash: nextTransactionHash,
      isCreate: tx.to === null,
      target: tx.to || ethers.constants.AddressZero,
      gasLimit: tx.gasLimit,
      data: tx.data,
    }

    compiledTxs.push(compiledTx)
    nextTransactionHash = getTransactionHash(compiledTx)
  }

  return {
    hash: nextTransactionHash,
    transactions: compiledTxs.reverse(),
  }
}

export const waitForBundleApproval = async (
  bundleHash: string,
  executor: Contract
): Promise<void> => {
  let bundleApproved = false
  while (!bundleApproved) {
    const remoteBundleHash = await executor.nextTransactionHash()
    if (remoteBundleHash === bundleHash) {
      bundleApproved = true
    }

    await sleep(5000)
  }
}

export const makeTextBoxy = (text: string): string => {
  const longestLineLength = text
    .split('\n')
    .reduce((prevLongestLineLength, currentLine) => {
      if (currentLine.length > prevLongestLineLength) {
        return currentLine.length
      } else {
        return prevLongestLineLength
      }
    }, 0)

  const lines = []
  lines.push(`**${'*'.repeat(longestLineLength)}**`)
  for (const line of text.split('\n')) {
    lines.push(`* ${line.padEnd(longestLineLength, ' ')} *`)
  }
  lines.push(`**${'*'.repeat(longestLineLength)}**`)

  return lines.join('\n')
}
