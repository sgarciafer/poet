import { getConfigurationPath } from '../helpers/CommandLineArgumentsHelper'
import { loadBitcoinScannerConfiguration } from '../bitcoin-scanner/configuration'
import { BitcoinScanner } from '../bitcoin-scanner/bitcoinScanner'

const configurationPath = getConfigurationPath()
const configuration = loadBitcoinScannerConfiguration(configurationPath)

async function start() {
  try {
    const bitcoinScanner = new BitcoinScanner(configuration)
    await bitcoinScanner.start()
    console.log('Bitcoin Scanner started successfully.')
  } catch (error) {
    console.log('Bitcoin Scanner failed to start. Error was: ', error)
  }
}

start()