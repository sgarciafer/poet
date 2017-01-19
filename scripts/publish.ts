import * as fetch from "isomorphic-fetch"
import { default as getCreator } from "../src/serialization/builder"

const myPrivateKey = '2461d5dc1bf2c48b73d271375a11f853f92aca53d328f35af5cbaead016ebeb5'

export default async function create() {
  const host = 'localhost'
  const port = 3000

  const creator = await getCreator()

  const claim = creator.createSignedClaim({
    type: 'Work',
    attributes: {
      name: 'La Gioconda VV',
      createdOn: '2016-11-31 00:00:00.000Z',
      param: process.argv[2]
    }
  }, myPrivateKey)

  console.log(claim)

  const response = await fetch(`http://${host}:${port}/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(claim)
  })

  console.log(await response.text())
}

if (!module.parent) {
  create().catch(error => {
    console.log(error, error.stack)
  })
}
