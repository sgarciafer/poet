import * as fs from 'fs'
import { validatePoetVersion } from '../helpers/ConfigurationHelper'

export interface BitcoinScannerConfiguration {
  readonly poetNetwork: string,
  readonly poetVersion: number[]
  readonly insightUrl: string
}

const defaultOptions: Partial<BitcoinScannerConfiguration> = {
  poetNetwork: 'BARD',
  poetVersion: [0, 0, 0, 2],
  insightUrl: 'https://test-insight.bitpay.com',
}

export function loadBitcoinScannerConfiguration(path: string): BitcoinScannerConfiguration {
  if (!fs.existsSync(path)) {
    console.error(`File "${path}" not found.`)
    process.exit()
  }

  const configuration = JSON.parse(fs.readFileSync(path, 'utf8'))

  if ('poetVersion' in configuration) {
    validatePoetVersion(configuration)
  }

  return {
    ...defaultOptions,
    ...configuration
  }
}