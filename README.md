### End points & API related for consumers

#### Sumbit a claim to a poet node:

endpoint: /api/user/claims

method: POST

payload: 
[{
  "nested": {
    "Poet": {
      "nested": {
        "Claim": {
          "fields": {
            "id": {
              "type": "bytes",
              "id": 1
            },
            "publicKey": {
              "type": "bytes",
              "id": 2
            },
            "signature": {
              "type": "bytes",
              "id": 3
            },
            "type": {
              "type": "string",
              "id": 4
            },
            "attributes": {
              "rule": "repeated",
              "type": "Attribute",
              "id": 5
            }
          }
        },
        "Block": {
          "fields": {
            "id": {
              "type": "bytes",
              "id": 1
            },
            "claims": {
              "rule": "repeated",
              "type": "Claim",
              "id": 2
            }
          }
        },
        "Attribute": {
          "fields": {
            "key": {
              "type": "string",
              "id": 1
            },
            "value": {
              "type": "string",
              "id": 2
            }
          }
        }
      }
    }
  }
}]




# Po.et

This repository holds two different projects right now. They will be split into separate repositories in the future. Specific READMEs for each can be found in their respective folders.

### Node 

The backend. Will be split into its own repository, poet-node. It'll most likely be a rename of this repository, though it could be a new repository to keep this one for historic purposes. 

See Po.et Node's [README](./node)

### Web 

The frontend. This will be split into another repository, [poet-web](https://github.com/poetapp/web). 

See Po.et Web's [README](./web)




