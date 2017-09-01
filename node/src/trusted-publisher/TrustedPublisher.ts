import { promisify } from 'util'

import * as Koa from 'koa'
import * as KoaBody from 'koa-body'
import * as KoaRoute from 'koa-route'
import * as bitcore from 'bitcore-lib'
import * as explorers from 'bitcore-explorers'
import { Fields, ClaimTypes, Claim, Block, ClaimBuilder, hex, POET } from 'poet-js'

import { getHash } from '../helpers/torrentHash' // TODO: use poet-js
import { Queue } from '../queue'
import { TrustedPublisherConfiguration } from './configuration'

export class TrustedPublisher {
  private readonly configuration: TrustedPublisherConfiguration
  private readonly queue: Queue
  private readonly koa: Koa
  private readonly bitcoinAddressPrivateKey: IPrivateKey
  private readonly insight: Insight
  private readonly broadcastTx: (tx: any) => Promise<any>
  private readonly getUtxo: (address: any) => Promise<any>

  constructor(configuration: TrustedPublisherConfiguration) {
    this.configuration = configuration
    this.queue = new Queue()
    this.koa = new Koa()
    this.bitcoinAddressPrivateKey = new bitcore.PrivateKey(configuration.bitcoinAddressPrivateKey)
    this.insight = new explorers.Insight(bitcore.Networks.testnet) // TODO: configurable insight url & use poet-insight-client
    this.broadcastTx = promisify(this.insight.broadcast.bind(this.insight) as (tx: any, cb: NodeCallback<any>) => void)
    this.getUtxo = promisify(this.insight.getUnspentUtxos.bind(this.insight) as (address: any, cb: NodeCallback<any>) => void)
  }

  public async start() {
    this.koa.use(this.handleErrors)
    this.koa.use(KoaBody({ textLimit: 1000000 }))
    this.koa.use(KoaRoute.post('/titles', this.postTitles))
    this.koa.use(KoaRoute.post('/licenses', this.postLicenses))
    this.koa.use(KoaRoute.post('/claims', this.postClaims))
    this.koa.use(KoaRoute.post('/v2/claims', this.postClaimsV2))
    this.koa.listen(this.configuration.port)
  }

  private async handleErrors(ctx: any, next: Function) {
    try {
      await next()
    } catch (error) {
      console.log(`Error processing ${ctx.method} ${ctx.path}`, error, error.stack)
      ctx.status = 503
      ctx.body = 'An error occurred while processing the transaction, please try again later.'
    }
  }

  private postTitles = async (ctx: any) => {
    const body = JSON.parse(ctx.request.body)
    const claims = [ClaimBuilder.createSignedClaim({
      type: ClaimTypes.TITLE,
      attributes: {
        [Fields.REFERENCE]: body.reference,
        [Fields.REFERENCE_OFFERING]: body.referenceOffering,
        [Fields.PROOF_TYPE]: "Bitcoin Transaction",
        [Fields.PROOF_VALUE]: JSON.stringify({
          txId: body.txId,
          ntxId: body.ntxId,
          outputIndex: body.outputIndex
        }),
        [Fields.REFERENCE_OWNER]: body.referenceOwner,
        [Fields.OWNER]: body.owner
      }
    }, this.configuration.notaryPrivateKey)]

    const blockClaims = await this.createBlock(claims)
    ctx.body = JSON.stringify({
      createdClaims: blockClaims
    })
  }

  private postLicenses = async (ctx: any) => {
    const body = JSON.parse(ctx.request.body)
    const claims = [ClaimBuilder.createSignedClaim({
      type: ClaimTypes.LICENSE,
      attributes: {
        [Fields.REFERENCE]: body.reference,
        [Fields.REFERENCE_OFFERING]: body.referenceOffering,
        [Fields.PROOF_TYPE]: "Bitcoin Transaction",
        [Fields.PROOF_VALUE]: JSON.stringify({
          txId: body.txId,
          ntxId: body.ntxId,
          outputIndex: body.outputIndex
        }),
        [Fields.REFERENCE_OWNER]: body.referenceOwner,
        [Fields.LICENSE_HOLDER]: body.owner
      }
    }, this.configuration.notaryPrivateKey)]
    const blockClaims = await this.createBlock(claims)
    ctx.body = JSON.stringify({
      createdClaims: blockClaims
    })
  }

  private postClaims = async (ctx: any) => {
    const signs = JSON.parse(ctx.request.body).signatures

    const claims: ReadonlyArray<Claim> = signs.map((sig: any) => {
      const claim = ClaimBuilder.serializedToClaim(
        new Buffer(new Buffer(sig.message, 'hex').toString(), 'hex')
      )
      claim.signature = sig.signature
      claim.id = new Buffer(ClaimBuilder.getId(claim)).toString('hex')
      return claim
    })

    const workClaims: ReadonlyArray<Claim> = claims.filter(_ => _.type === ClaimTypes.WORK)

    console.log('POST /claims', claims)

    // Hack to use the Work's signature for the Offering
    for (const claim of claims.filter(_ => _.type === ClaimTypes.OFFERING)) {
      const workClaim = workClaims && workClaims.length && workClaims[0]

      if (!workClaim)
        throw new Error(`Unsupported: an OFFERING claim was POSTed without any WORK claim`)

      claim.attributes = {
        ...claim.attributes,
        [Fields.REFERENCE]: workClaim.id
      }
    }

    const titleClaims: ReadonlyArray<Claim> = workClaims.map(claim =>
      ClaimBuilder.createSignedClaim({
        type: ClaimTypes.TITLE,
        attributes: {
          reference: claim.id,
          owner: claim.publicKey,
        }
      }, this.configuration.notaryPrivateKey)
    )

    const editWorkClaims = workClaims.filter(_ => _.attributes.supersedes)

    for (const claim of editWorkClaims) {
      // TODO: ideally, assert that claim.owner === claim.supersedes.owner
      // certification/work.ts has the final say on this
    }

    const blockClaims = await this.createBlock([
      ...claims,
      ...titleClaims
    ])

    ctx.body = JSON.stringify({
      createdClaims: blockClaims
    })
  }

  private postClaimsV2 = async (ctx: any) => {
    const signs = JSON.parse(ctx.request.body).claims

    const claims: ReadonlyArray<Claim> = signs.map((sig: any) => {
      const claim = ClaimBuilder.serializedToClaim(
        new Buffer(sig.claim, 'hex')
      )
      claim.signature = sig.signature
      claim.id = new Buffer(ClaimBuilder.getId(claim)).toString('hex')
      return claim
    })

    const workClaims: ReadonlyArray<Claim> = claims.filter(_ => _.type === ClaimTypes.WORK)

    console.log('POST /claims', claims)
    const titleClaims: ReadonlyArray<Claim> = workClaims.map(claim =>
      ClaimBuilder.createSignedClaim({
        type: ClaimTypes.TITLE,
        attributes: {
          reference: claim.id,
          owner: claim.publicKey,
        }
      }, this.configuration.notaryPrivateKey)
    )

    const blockClaims = await this.createBlock([
      ...claims,
      ...titleClaims
    ])

    ctx.body = JSON.stringify({
      createdClaims: blockClaims
    })
  }

  private createBlock = async (claims: ReadonlyArray<Claim>) => {
    const certificates: ReadonlyArray<Claim> = claims.map(claim => ClaimBuilder.createSignedClaim({
      type: ClaimTypes.CERTIFICATE,
      attributes: {
        [Fields.REFERENCE]: claim.id,
        [Fields.CERTIFICATION_TIME]: '' + Date.now()
      }
    }, this.configuration.notaryPrivateKey))

    const block: Block = ClaimBuilder.createBlock([...claims, ...certificates])

    await this.timestampClaimBlock(block)

    try {
      await this.queue.announceBlockToSend(block)
    } catch (error) {
      console.log('Could not announce block', error, error.stack)
    }

    return block.claims
  }

  private timestampClaimBlock = async (block: Block): Promise<void> => {
    const id = await getHash(ClaimBuilder.serializeBlockForSave(block), block.id)

    // We're retrieving UTXO using bitcore's insight client rather than our own, but both work fine.
    // const utxo = await InsightClient.Address.Utxos.get(poetAddress)
    const utxoBitcore = await this.getUtxo(this.configuration.bitcoinAddress)
    console.log('\n\nutxoBitcore', JSON.stringify(utxoBitcore, null, 2))

    const data = Buffer.concat([
      POET,
      new Buffer([0, 0, 0, this.configuration.poetVersion]), // TODO: add a function version(versionString: string): Buffer to poet-js
      new Buffer(id, 'hex')
    ])
    const tx = new bitcore.Transaction()
      .from(utxoBitcore)
      .change(this.configuration.bitcoinAddress)
      .addData(data)
      .sign(this.bitcoinAddressPrivateKey)

    console.log('\nBitcoin transaction hash is', tx.hash)
    console.log('Normalized transaction hash is', tx.nid)
    console.log('Torrent hash is', id)

    console.log('\nBroadcasting Tx...', JSON.stringify(tx, null, 2))

    // We're using bitcore's insight client to broadcast transactions rather than our own, since bitcore handles serialization well
    const txPostResponse = await this.broadcastTx(tx)

    console.log('\nBroadcasted Tx:', txPostResponse)
  }

}