import BlockchainService from "../../domainService";
import {BlockMetadata} from "../../../events";
import {Claim, LICENSE} from "../../../claim";
import Fields from "../../fields";
import { EventType } from '../../orm/events/events';
import * as fetch from 'isomorphic-fetch'
import Work from '../../orm/domain/work';
import Offering from '../../orm/domain/offering';
import Profile from '../../orm/domain/profile';

const Reference = Fields.REFERENCE
const ReferenceOffering = Fields.REFERENCE_OFFERING
const Holder = Fields.LICENSE_HOLDER
const ProofValue = Fields.PROOF_VALUE
const ProofType = Fields.PROOF_TYPE

const BitcoinPayment = 'Bitcoin Transaction'
const LicenseOwner = 'License Owner'

async function fetchTx(txId: string): Promise<any> {
  return await fetch(`https://test-insight.bitpay.com/api/tx/${txId}`)
    .then(res => res.text())
    .then(text => {
      try {
        return JSON.parse(text)
      } catch(error) {
        return null
      }
    })
}

interface Validation {
  ownerOnRecord: string
  holder: Profile
  referenceOffering: Offering
  proofType: string
  proofValue: {
    txId: string
    outputNumber: string
  }
}

export async function validateBitcoinPayment(service: BlockchainService, claim: Claim, txInfo: BlockMetadata, work: Work): Promise<false | Validation> {
  const workId = claim.attributes[Reference]
  const referenceOfferingId = claim.attributes[ReferenceOffering]
  const referenceOffering = referenceOfferingId
    && await service.getOffering(referenceOfferingId)
  if (!referenceOffering) {
    console.log('Could not find referred offering')
    return false
  }

  const ownerStated = claim.attributes[Fields.REFERENCE_OWNER]
  const ownerOnRecord = await service.getOwnerPublicKey(workId)

  if (ownerOnRecord && ownerStated && ownerOnRecord !== ownerStated) {
    console.log('Different owner on record')
    return false
  }

  const holderId = claim.attributes[Holder]
  const holder = holderId
    && await service.profileRepository.findOneById(holderId)

  const proofType = claim.attributes[ProofType]
  let proofValue
  try {
    proofValue = JSON.parse(claim.attributes[ProofValue])
  } catch(err) {
    console.log('invalid json for proof value', claim)
    return false
  }
  if (!proofType || !proofValue) {
    console.log('Missing proof information', claim)
    return false
  }
  if (proofType === 'Bitcoin Transaction') {

    try {
      const tx = await fetchTx(proofValue.txId)
      if (!tx) {
        console.log('no tx found')
        return false
      }
      const output = tx.vout[proofValue.outputIndex]
      if (!output) {
        console.log('no output found')
        return false
      }
      const hasPaymentAddress = (address: string) => address === referenceOffering.attributes[Fields.PAYMENT_ADDRESS]
      const outputsMatching = output.scriptPubKey.addresses.filter(hasPaymentAddress)
      if (!outputsMatching.length) {
        console.log('no output with matching address found')
        return false
      }
      const value = outputsMatching.reduce((prev: number, next: {value: number}) => prev - (-next.value), 0)
      if (Math.abs(value - parseFloat(referenceOffering.attributes[Fields.PAYMENT_AMOUNT])) < 1e-8) {
        console.log('mismatching amount')
        return false
      }
    } catch (error) {
      console.log('unexpected error', error, error.stack)
      return false
    }
  } else {
    console.log("Unknown proof type", proofType)
    return false
  }
  return { ownerOnRecord, holder, referenceOffering, proofType, proofValue }
}

export async function validateBitcoinPaymentForLicense(service: BlockchainService, claim: Claim, txInfo: BlockMetadata, work: Work) {
  const validation = await validateBitcoinPayment(service, claim, txInfo, work)
  if (validation === false) {
    return
  }
  const { ownerOnRecord, holder, referenceOffering, proofType, proofValue } = validation
  const owner = await service.getOrCreateProfile(ownerOnRecord)
  await service.saveEvent(claim.id, EventType.LICENSE_BOUGHT, work, holder, undefined, owner)
  await service.saveEvent(claim.id, EventType.LICENSE_SOLD, work, owner)

  const license = await service.licenseRepository.persist(service.licenseRepository.create({
    id: claim.id,
    reference: work,
    licenseHolder: holder,
    referenceOffering: referenceOffering,
    proofType: proofType,
    proofValue: proofValue,
    bitcoinTx: proofValue.txId,
    licenseEmitter: ownerOnRecord
  }))
  work.publishers = work.publishers || []
  work.publishers.push(holder)
  await service.workRepository.persist(work)
  return license
}

export async function validateSelfOwnedLicense(service: BlockchainService, claim: Claim, txInfo: BlockMetadata, work: Work) {
  const workId = claim.attributes[Reference]

  const ownerStated = claim.attributes[Fields.REFERENCE_OWNER]
  const ownerOnRecord = await service.getOwnerPublicKey(workId)

  if (ownerOnRecord && ownerStated && ownerOnRecord !== ownerStated) {
    console.log('Different owner on record')
    return
  }

  const holderId = claim.attributes[Holder]
  if (holderId !== ownerStated) {
    return
  }

  const owner = await service.getOrCreateProfile(ownerOnRecord)
  await service.saveEvent(claim.id, EventType.SELF_LICENSE, work, owner)

  const license = await service.licenseRepository.persist(service.licenseRepository.create({
    id: claim.id,
    reference: work,
    licenseHolder: owner,
    proofType: LicenseOwner,
    licenseEmitter: owner
  }))
  work.publishers = work.publishers || []
  work.publishers.push(owner)
  await service.workRepository.persist(work)
  return license
}

export default {
  type: LICENSE,
  hook: async (service: BlockchainService, claim: Claim, txInfo: BlockMetadata) => {
    const workId = claim.attributes[Reference]
    if (!workId) {
      console.log('Received weird license with no "reference" field', claim)
      return
    }
    const work = await service.workRepository.findOne({ id: workId })
    if (!work) {
      console.log('Could not find referred work', claim)
      return
    }
    if (claim.attributes[ProofType] === BitcoinPayment) {
      return validateBitcoinPaymentForLicense(service, claim, txInfo, work)
    }
    if (claim.attributes[ProofType] === LicenseOwner) {
      return validateSelfOwnedLicense(service, claim, txInfo, work)
    }
  }
}
