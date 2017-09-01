import Bluebird = require("bluebird")
import PoetInsightListener from '../insight'
import { BitcoinScannerConfiguration } from './configuration'
import { Queue } from '../queue'

export class BitcoinScanner {
  private readonly configuration: BitcoinScannerConfiguration

  constructor(configuration: BitcoinScannerConfiguration) {
    this.configuration = configuration
  }

  public async start() {
    let insight: PoetInsightListener

    const queue = new Queue()

    console.log('Requesting BlockChain info from Insight...')

    try {
      insight = new PoetInsightListener(this.configuration.insightUrl, this.configuration.poetVersion)

      insight.subscribeBitcoinBlock(async (block) => {
        // Store ntxid => txid info
        for (let tx of block.transactions) {
          await queue.announceNormalizedTransaction({
            ntxId: tx.nid,
            txId: tx.id
          })
        }
      })

      queue.bitcoinBlockProcessed().subscribeOnNext(async (latest: number) => {
        console.log('Scanning block', latest + 1)
        const height = parseInt('' + latest, 10) + 1
        try {
          const block = await insight.fetchBitcoreBlockByHeight(height)
          insight.scanBitcoreBlock(block, height)
        } catch (e) {
          const latestHeight = await insight.getCurrentHeight()
          if (latestHeight === height - 1) {
            return
          }
          queue.dispatchWork('tryScan', height - 1)
        }
      })

      process.nextTick(() => {
        queue.workThread('tryScan', (data: string) => {
          const height = JSON.parse(data)
          queue.announceBitcoinBlockProcessed(height)
        })
      })

      insight.subscribeBlock(async (block) => {
        console.log('found block info', block)
        try {
          await queue.announceBitcoinBlock(block)
        } catch (error) {
          console.log('Could not publish block', error, error.stack)
        }
      })

      insight.subscribeTx(async (tx) => {
        console.log('found tx', tx)
        try {
          await queue.announceBitcoinTransaction(tx)
        } catch (error) {
          console.log('Could not publish tx', error, error.stack)
        }
      })
    } catch (error) {
      console.log('Could not initialize insight', error, error.stack)
      throw error
    }
    console.log('Setup complete!')
  }
}