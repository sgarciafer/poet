import * as socketIO from 'socket.io-client'
import * as fetch from 'isomorphic-fetch'
import { POET, VERSION } from 'poet-js';
import { InsightClient as Client, ApiMode } from 'insight-client-js'
const bitcore = require('bitcore-lib')

import { BitcoinBlockMetadata, BlockMetadata } from './events'

export const InsightClient = new Client(ApiMode.Test, fetch)

const notNull = (x: any) => !!x
const parseJson = (x: any) => {
  return x.text().then((text: any) => {
    try {
      return JSON.parse(text)
    } catch (e) {
      console.log('Could not parse', text)
      throw e
    }
  })
}
const pluckMember = (name: string) => (obj: any) => obj[name]
const getTransaction = pluckMember('rawtx')
const getBuffer = (data: string) => {
  try {
    return new Buffer(data, 'hex')
  } catch (e) {
    console.log('Error processing', data)
    throw e
  }
}
const turnToBitcoreTx = bitcore.Transaction
const turnToBitcoreBlock: (something: Buffer) => BitcoinBlock = bitcore.Block

export interface TxInfoListener {
  (txInfo: BlockMetadata): any
}

export interface BlockInfoListener {
  (block: BitcoinBlockMetadata): any
}

export interface BitcoinBlockListener {
  (block: BitcoinBlock): any
}

export interface BitcoinBlock {
  hash: string
  transactions: any[]
  header: {
    time: number
    prevHash: string
  }
}

export default class PoetInsightListener {

  insightUrl: string
  socket: SocketIOClient.Socket
  txListeners: TxInfoListener[]
  poetBlockListeners: BlockInfoListener[]
  bitcoinBlockListeners: BitcoinBlockListener[]

  constructor(insightUrl: string) {
    this.insightUrl = insightUrl
    this.txListeners = []
    this.poetBlockListeners = []
    this.bitcoinBlockListeners = []

    this.socket = socketIO(this.insightUrl)

    this.initSocket()
  }

  initSocket() {
    this.socket.on('error', (error: any) => {
      console.log(error)
    })
    this.socket.on('connect', () => {
      this.socket.emit('subscribe', 'inv')
    })
    this.socket.on('block', this.manageNewBlock.bind(this))
    this.socket.on('tx', this.manageNewTx.bind(this))
  }

  async manageNewTx(tx: any) {
    try {
      const poetData = await this.doesSocketTxContainPoetInfo(tx);
      if (poetData) {
        this.txListeners.forEach(txListener => {
          txListener(poetData)
        })
      }
    } catch (error) {
      console.log('Managing tx failed', error, error.stack)
    }
  }

  async manageNewBlock(blockHash: string) {
    try {
      const height = await this.fetchHeight(blockHash)
      const bitcoreBlock = await this.fetchBitcoreBlock(blockHash)
      this.scanBitcoreBlock(bitcoreBlock, height)
      this.notifyBitcoinBlock(bitcoreBlock)
    } catch (error) {
      console.log('Error handling block', error, error.stack)
    }
  }

  scanBitcoreBlock(block: BitcoinBlock, height: number) {
    const txs = block.transactions.map((tx: any, index: number): BlockMetadata | null => {
      const poetData = this.doesBitcoreTxContainPoetInfo(tx)
      if (!poetData) {
        return
      }
      return Object.assign({}, poetData, {
        blockHeight      : height,
        blockHash        : block.hash,
        transactionOrder : index
      })
    }).filter(notNull)
    const blockInfo: BitcoinBlockMetadata = {
      blockHeight : height,
      parentHash  : bitcore.util.buffer.reverse(block.header.prevHash).toString('hex'),
      blockHash   : block.hash,
      timestamp   : block.header.time,
      poet        : txs
    }
    this.notifyPoetData(blockInfo)
    return blockInfo
  }

  doesBitcoreTxContainPoetInfo(tx: any): BlockMetadata {
    const check = function(script: any, index: number) {
      if (script.classify() !== bitcore.Script.types.DATA_OUT)
        return
      const data: Buffer = script.getData()

      if (data.indexOf(POET) === 0) {

        console.log('its POET!')

        if (data.indexOf(VERSION) === 8) {

          console.log('its version 8!')

          return {
            transactionHash : tx.hash,
            outputIndex     : index,
            torrentHash     : data.slice(8).toString('hex')
          }

        }

        return null
      }

      return null
    }
    return tx.outputs.reduce(
      (prev: boolean, next: any, index: number) => prev || check(next.script, index), false
    )
  }

  doesSocketTxContainPoetInfo (tx: any) {
    return this.fetchTxByHash(tx.txid).then(this.doesBitcoreTxContainPoetInfo)
  }

  fetchBitcoreBlockByHeight(height: number): Promise<BitcoinBlock> {
    return this.fetchBlockHash(height).then(hash => this.fetchBitcoreBlock(hash))
  }

  fetchBitcoreBlock(hash: string): Promise<BitcoinBlock> {
    return fetch(`${this.insightUrl}/api/rawblock/${hash}`)
      .then(parseJson)
      .then(pluckMember('rawblock'))
      .then(getBuffer)
      .then(turnToBitcoreBlock) as Promise<BitcoinBlock>
  }

  fetchBlockHash(height: number): Promise<string> {
    return fetch(`${this.insightUrl}/api/block-index/${height}`)
      .then(parseJson)
      .then(pluckMember('blockHash')) as Promise<string>
  }

  fetchHeight(hash: string): Promise<number> {
    return fetch(`${this.insightUrl}/api/block/${hash}`)
      .then(parseJson)
      .then(pluckMember('height'))
  }

  fetchTxByHash(txHash: string) {
    const url = `${this.insightUrl}/api/rawtx/${txHash}`

    return fetch(url)
      .then(parseJson)
      .then(getTransaction)
      .then(turnToBitcoreTx)
  }

  getCurrentHeight() {
    const url = `${this.insightUrl}/api/status`

    return fetch(url)
      .then(parseJson)
      .then(pluckMember('info'))
      .then(pluckMember('blocks'))
  }

  notifyBitcoinBlock(newState: BitcoinBlock) {
    this.bitcoinBlockListeners.forEach(listener => listener(newState))
  }

  notifyPoetData(newState: BitcoinBlockMetadata) {
    this.poetBlockListeners.forEach(listener => listener(newState))
  }

  subscribeTx(listener: TxInfoListener) {
    this.txListeners.push(listener)
  }

  subscribeBlock(listener: BlockInfoListener) {
    this.poetBlockListeners.push(listener)
  }

  subscribeBitcoinBlock(listener: BitcoinBlockListener) {
    this.bitcoinBlockListeners.push(listener)
  }
}
