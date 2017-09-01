import * as fs from 'fs'

export interface TrustedPublisherConfiguration {
  readonly notaryPrivateKey: string
  readonly bitcoinAddressPrivateKey: string
  readonly bitcoinAddress: string
  readonly port: number
  readonly poetVersion: number
}

const defaultOptions: Partial<TrustedPublisherConfiguration> = {
  port: 6000,
  poetVersion: 2
}

export function loadTrustedPublisherConfiguration(path: string): TrustedPublisherConfiguration {
  if (!fs.existsSync(path)) {
    console.error(`File "${path}" not found.`)
    process.exit()
  }

  return {
    ...defaultOptions,
    ...JSON.parse(fs.readFileSync(path, 'utf8'))
  }
}