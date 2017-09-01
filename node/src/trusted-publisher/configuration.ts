import * as fs from 'fs'
import { validatePoetVersion } from '../helpers/ConfigurationHelper'

export interface TrustedPublisherConfiguration {
  readonly notaryPrivateKey: string
  readonly bitcoinAddressPrivateKey: string
  readonly bitcoinAddress: string
  readonly port: number
  readonly poetNetwork: string
  readonly poetVersion: number[]
}

const defaultOptions: Partial<TrustedPublisherConfiguration> = {
  port: 6000,
  poetNetwork: 'BARD',
  poetVersion: [0, 0, 0, 2]
}

export function loadTrustedPublisherConfiguration(path: string): TrustedPublisherConfiguration {
  if (!fs.existsSync(path)) {
    console.error(`File "${path}" not found.`)
    process.exit()
  }

  const configuration = JSON.parse(fs.readFileSync(path, 'utf8'))

  if ('poetVersion' in configuration) {
    validatePoetVersion(configuration.poetVersion)
  }

  return {
    ...defaultOptions,
    ...configuration
  }
}